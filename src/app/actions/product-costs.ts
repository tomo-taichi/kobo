"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  calcCostJpy,
  calcCostEur,
  calcWholesaleEur,
  mfgMinutesToAmounts,
  type ManufacturingMinutes,
} from "@/lib/pricing";

type ColorEdit = { productColorId: string; markupRate: number; retailRate: number; retailPriceEur: number };

// Per-colour cost model: manufacturing, main quantity and the EUR rate are Product-owned; the
// MAIN material's price varies per colour (material_colors override, else base). Each enabled
// colour (product_colors) gets its own computed cost stack + manually-set Retail Price.
//
// ADR-0011 §9.7 — non-main materials (lining + product_materials) are Version-owned now and edited
// on the Model version (propagated by apply_model_version_recipe). This action no longer accepts or
// writes them: it READS the product's Version-synced snapshot to get the non-main cost, and never
// touches product_materials or lining_m_quantity. Editable here = main quantity + manufacturing time.
export async function updateProductCosts(
  productId: string,
  mainQuantity: number,
  manufacturingMinutes: ManufacturingMinutes,
  laborRate: number,
  costEurRate: number,
  colorEdits: ColorEdit[]
): Promise<string | null> {
  const supabase = await createClient();

  // The 6 steps are entered as time; derive the JPY amounts (kept in sync with *_minutes).
  const manufacturingCosts = mfgMinutesToAmounts(manufacturingMinutes, laborRate);

  // Main/lining base set prices + main id (per-colour prices) + lining qty (Version-owned; read only)
  const { data: product } = await supabase
    .from("products")
    .select(`
      status,
      main_material_id,
      lining_m_quantity,
      main_mat:materials!main_material_id(set_price_jpy),
      lining_mat:materials!lining_material_id(set_price_jpy)
    `)
    .eq("id", productId)
    .single();

  // Finalised products are locked — reject cost edits (the UI also disables them).
  if ((product as any)?.status === "final") return "Product is finalised — unlock to edit.";

  const mainMaterialId = (product as any)?.main_material_id ?? null;
  const mainBase       = Number((product as any)?.main_mat?.set_price_jpy   ?? 0);
  const liningBase     = Number((product as any)?.lining_mat?.set_price_jpy ?? 0);
  const liningQuantity = Number((product as any)?.lining_m_quantity ?? 0);

  // Non-main cost = the product's Version-synced snapshot: lining (Version-owned) + the
  // product_materials rows (Version-owned). Read here to recompute cost — never rewritten.
  const { data: pmRows } = await supabase
    .from("product_materials").select("material_id, usage_amount").eq("product_id", productId);
  const pm = (pmRows ?? []) as { material_id: string; usage_amount: number }[];
  const pmIds = Array.from(new Set(pm.map((r) => r.material_id)));
  const pmSetPrice = new Map<string, number>();
  if (pmIds.length > 0) {
    const { data: mats } = await supabase.from("materials").select("id, set_price_jpy").in("id", pmIds);
    (mats ?? []).forEach((m: any) => pmSetPrice.set(m.id, Number(m.set_price_jpy ?? 0)));
  }

  // Cost shared across colours: lining + other non-main materials + manufacturing
  const nonMainCostJpy =
    liningBase * liningQuantity +
    pm.reduce((sum, r) => sum + (pmSetPrice.get(r.material_id) ?? 0) * Number(r.usage_amount), 0);
  const mfgCost = calcCostJpy(0, manufacturingCosts);

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
    const { error } = await supabase.from("product_colors").update({
      material_cost_jpy: materialCostJpy,
      cost_jpy:          costJpy,
      cost_eur:          costEur,
      markup_rate:       ce.markupRate,
      wholesale_eur:     calcWholesaleEur(costEur, ce.markupRate),  // Ideal WS = Cost × Markup
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
      material_cost_jpy: baseMaterialCost,
      cost_jpy:          baseCostJpy,
      cost_eur:          baseCostEur,
      cost_eur_rate:     costEurRate,
      markup_rate:       baseMarkup,
      wholesale_eur:     calcWholesaleEur(baseCostEur, baseMarkup),
      retail_rate:       first?.retailRate ?? 3.5,
      retail_price_eur:  first?.retailPriceEur ?? 0,
      // Time inputs (source of truth) + derived JPY amounts (kept in sync for existing readers).
      cutting_minutes:   manufacturingMinutes.cutting,
      sewing_minutes:    manufacturingMinutes.sewing,
      knitting_minutes:  manufacturingMinutes.knitting,
      thread_minutes:    manufacturingMinutes.thread,
      finish_minutes:    manufacturingMinutes.finish,
      packing_minutes:   manufacturingMinutes.packing,
      cutting_cost_jpy:  manufacturingCosts.cutting,
      sewing_cost_jpy:   manufacturingCosts.sewing,
      knitting_cost_jpy: manufacturingCosts.knitting,
      thread_cost_jpy:   manufacturingCosts.thread,
      finish_cost_jpy:   manufacturingCosts.finish,
      packing_cost_jpy:  manufacturingCosts.packing,
    })
    .eq("id", productId);
  if (error) return error.message;

  // Materials & Cost now lives on the /edit page (merged view).
  revalidatePath(`/products/${productId}/edit`);
  return null;
}
