"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  calcCostJpy,
  calcCostEur,
  calcWholesaleEur,
  type ManufacturingCosts,
} from "@/lib/pricing";

type AdditionalRow = { materialId: string; quantity: number; role: string };
type ColorEdit = { productColorId: string; markupRate: number; retailRate: number; retailPriceEur: number };

// Per-colour cost model: manufacturing, usage amounts and the EUR rate are shared at the
// product level; the MAIN material's price varies per colour (material_colors override,
// else base). Each enabled colour (product_colors) gets its own computed cost stack +
// manually-set Retail Price. Non-main materials use their base price.
export async function updateProductCosts(
  productId: string,
  mainQuantity: number,
  liningQuantity: number,
  additionalRows: AdditionalRow[],
  manufacturingCosts: ManufacturingCosts,
  costEurRate: number,
  colorEdits: ColorEdit[]
): Promise<string | null> {
  const supabase = await createClient();

  // Main/lining base set prices + the main material id (for per-colour prices)
  const { data: product } = await supabase
    .from("products")
    .select(`
      main_material_id,
      main_mat:materials!main_material_id(set_price_jpy),
      lining_mat:materials!lining_material_id(set_price_jpy)
    `)
    .eq("id", productId)
    .single();

  const mainMaterialId = (product as any)?.main_material_id ?? null;
  const mainBase       = Number((product as any)?.main_mat?.set_price_jpy   ?? 0);
  const liningBase     = Number((product as any)?.lining_mat?.set_price_jpy ?? 0);

  // Additional materials: base prices + single colour (to pin material_color_id)
  const additionalIds = additionalRows.map((r) => r.materialId).filter(Boolean);
  const additionalSetPrices = new Map<string, number>();
  const additionalPinnedColor = new Map<string, string>();
  if (additionalIds.length > 0) {
    const [{ data: mats }, { data: mcs }] = await Promise.all([
      supabase.from("materials").select("id, set_price_jpy").in("id", additionalIds),
      supabase.from("material_colors").select("id, material_id").in("material_id", additionalIds),
    ]);
    (mats ?? []).forEach((m: any) => additionalSetPrices.set(m.id, Number(m.set_price_jpy)));
    const byMat = new Map<string, string[]>();
    (mcs ?? []).forEach((r: any) => { const a = byMat.get(r.material_id) ?? []; a.push(r.id); byMat.set(r.material_id, a); });
    for (const [mid, ids] of byMat) if (ids.length === 1) additionalPinnedColor.set(mid, ids[0]);
  }

  // Cost shared across colours: lining + additional materials + manufacturing
  const nonMainCostJpy =
    liningBase * liningQuantity +
    additionalRows.reduce((sum, r) => sum + (additionalSetPrices.get(r.materialId) ?? 0) * r.quantity, 0);
  const mfgCost = calcCostJpy(0, manufacturingCosts);

  // Replace additional product_materials (preserve pinned single colour)
  await supabase.from("product_materials").delete().eq("product_id", productId);
  if (additionalRows.length > 0) {
    const { error: insertError } = await supabase.from("product_materials").insert(
      additionalRows.map((r) => ({
        product_id:        productId,
        material_id:       r.materialId,
        usage_amount:      r.quantity,
        material_group:    r.role || null,
        material_color_id: additionalPinnedColor.get(r.materialId) ?? null,
      }))
    );
    if (insertError) return insertError.message;
  }

  // Main material's per-colour prices (override, else base)
  const mainColorPrice = new Map<string, number>();
  if (mainMaterialId) {
    const { data: mcs } = await supabase
      .from("material_colors")
      .select("id, set_price_jpy")
      .eq("material_id", mainMaterialId);
    (mcs ?? []).forEach((r: any) => mainColorPrice.set(r.id, r.set_price_jpy != null ? Number(r.set_price_jpy) : mainBase));
  }

  // Map each product_color → its main material colour
  const { data: pcs } = await supabase.from("product_colors").select("id, material_color_id").eq("product_id", productId);
  const pcMaterialColor = new Map<string, string>();
  (pcs ?? []).forEach((r: any) => pcMaterialColor.set(r.id, r.material_color_id));

  // Persist each colour's computed cost stack
  for (const ce of colorEdits) {
    const matColorId = pcMaterialColor.get(ce.productColorId);
    const mainPrice  = (matColorId && mainColorPrice.get(matColorId) != null) ? mainColorPrice.get(matColorId)! : mainBase;
    const materialCostJpy = mainPrice * mainQuantity + nonMainCostJpy;
    const costJpy = materialCostJpy + mfgCost;
    const costEur = calcCostEur(costJpy, costEurRate || 1);
    const wholesaleEur = calcWholesaleEur(costEur, ce.markupRate);
    const { error } = await supabase.from("product_colors").update({
      material_cost_jpy: materialCostJpy,
      cost_jpy:          costJpy,
      cost_eur:          costEur,
      markup_rate:       ce.markupRate,
      wholesale_eur:     wholesaleEur,
      retail_rate:       ce.retailRate,
      retail_price_eur:  ce.retailPriceEur,
    }).eq("id", ce.productColorId);
    if (error) return error.message;
  }

  // Product-level shared fields + a legacy/base snapshot (base price & first colour)
  const baseMaterialCost = mainBase * mainQuantity + nonMainCostJpy;
  const baseCostJpy = baseMaterialCost + mfgCost;
  const baseCostEur = calcCostEur(baseCostJpy, costEurRate || 1);
  const first = colorEdits[0];
  const baseMarkup = first?.markupRate ?? 3.0;
  const { error } = await supabase
    .from("products")
    .update({
      main_m_quantity:   mainQuantity,
      lining_m_quantity: liningQuantity,
      material_cost_jpy: baseMaterialCost,
      cost_jpy:          baseCostJpy,
      cost_eur:          baseCostEur,
      cost_eur_rate:     costEurRate,
      markup_rate:       baseMarkup,
      wholesale_eur:     calcWholesaleEur(baseCostEur, baseMarkup),
      retail_rate:       first?.retailRate ?? 3.5,
      retail_price_eur:  first?.retailPriceEur ?? 0,
      cutting_cost_jpy:  manufacturingCosts.cutting,
      sewing_cost_jpy:   manufacturingCosts.sewing,
      knitting_cost_jpy: manufacturingCosts.knitting,
      thread_cost_jpy:   manufacturingCosts.thread,
      finish_cost_jpy:   manufacturingCosts.finish,
      packing_cost_jpy:  manufacturingCosts.packing,
    })
    .eq("id", productId);
  if (error) return error.message;

  revalidatePath(`/products/${productId}/costs`);
  return null;
}
