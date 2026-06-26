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

export async function updateProductCosts(
  productId: string,
  mainQuantity: number,
  liningQuantity: number,
  additionalRows: AdditionalRow[],
  manufacturingCosts: ManufacturingCosts,
  costEurRate: number,
  markupRate: number,
  retailRate: number,
  retailPriceEur: number
): Promise<string | null> {
  const supabase = await createClient();

  // Fetch product to get main/lining set prices via FK join
  const { data: product } = await supabase
    .from("products")
    .select(`
      main_mat:materials!main_material_id(set_price_jpy),
      lining_mat:materials!lining_material_id(set_price_jpy)
    `)
    .eq("id", productId)
    .single();

  const mainSetPrice   = Number((product as any)?.main_mat?.set_price_jpy   ?? 0);
  const liningSetPrice = Number((product as any)?.lining_mat?.set_price_jpy ?? 0);

  // Fetch set prices for additional materials
  const additionalSetPrices = new Map<string, number>();
  const additionalIds = additionalRows.map((r) => r.materialId).filter(Boolean);
  if (additionalIds.length > 0) {
    const { data: mats } = await supabase
      .from("materials")
      .select("id, set_price_jpy")
      .in("id", additionalIds);
    (mats ?? []).forEach((m: any) => additionalSetPrices.set(m.id, Number(m.set_price_jpy)));
  }

  // Material cost = Set Price × Quantity
  const materialCostJpy =
    mainSetPrice * mainQuantity +
    liningSetPrice * liningQuantity +
    additionalRows.reduce((sum, r) => sum + (additionalSetPrices.get(r.materialId) ?? 0) * r.quantity, 0);

  const costJpy      = calcCostJpy(materialCostJpy, manufacturingCosts);
  const costEur      = calcCostEur(costJpy, costEurRate || 1);
  const wholesaleEur = calcWholesaleEur(costEur, markupRate);          // ideal WS (EUR), reference
  // retailPriceEur is entered manually on the form (the Order-adopted price).

  // Replace additional product_materials
  await supabase.from("product_materials").delete().eq("product_id", productId);
  if (additionalRows.length > 0) {
    const { error: insertError } = await supabase.from("product_materials").insert(
      additionalRows.map((r) => ({
        product_id:     productId,
        material_id:    r.materialId,
        usage_amount:   r.quantity,
        material_group: r.role || null,
      }))
    );
    if (insertError) return insertError.message;
  }

  const { error } = await supabase
    .from("products")
    .update({
      main_m_quantity:   mainQuantity,
      lining_m_quantity: liningQuantity,
      material_cost_jpy: materialCostJpy,
      cost_jpy:          costJpy,
      cost_eur:          costEur,
      cost_eur_rate:     costEurRate,
      markup_rate:       markupRate,
      wholesale_eur:     wholesaleEur,
      retail_rate:       retailRate,
      retail_price_eur:  retailPriceEur,
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
