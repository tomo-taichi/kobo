import type { SupabaseClient } from "@supabase/supabase-js";
import { getFormOptions } from "@/lib/list-options";
import { getManufacturingPresets } from "@/lib/manufacturing-presets";
import { loadModelsForPicker } from "@/lib/models-picker-data";

// One materials query that satisfies BOTH the Basic-Info picker (needs colours)
// and the Cost form (needs set_price/unit_type).
const MATERIAL_SELECT =
  "id, name, color, category, material_number, set_price_jpy, unit_type, " +
  "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
  "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, " +
  "colors:material_colors(id, color), seasons(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductEditBundle = Record<string, any>;

// Loads every prop the product edit view needs (Basic Info + Materials & Cost +
// Cost Summary). Shared by the /edit page and the list-page popup. Returns null
// when the product doesn't exist.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadProductEditBundle(supabase: SupabaseClient<any>, id: string): Promise<ProductEditBundle | null> {
  const [
    productResult, seasonsResult, pastModelsResult, materialsResult,
    productColorsResult, productMaterialsResult, settingsResult, formOptions, tagsResult, mfgPresets, imagesResult, models,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, status, finalized_at, season_id, model_name, model_id, model_version_id, is_sample, is_invalid, orderable_sizes, " +
        "product_category, product_sex, " +
        "main_material_id, main_m_category, main_m_name, main_m_color, " +
        "main_m_comp1_label, main_m_comp1_pct, main_m_comp2_label, main_m_comp2_pct, " +
        "main_m_comp3_label, main_m_comp3_pct, main_m_comp4_label, main_m_comp4_pct, " +
        "main_m_comp5_label, main_m_comp5_pct, " +
        "lining_material_id, lining_m_category, lining_m_name, lining_m_color, lining_material_color_id, " +
        "lining_m_comp1_label, lining_m_comp1_pct, lining_m_comp2_label, lining_m_comp2_pct, " +
        "lining_m_comp3_label, lining_m_comp3_pct, lining_m_comp4_label, lining_m_comp4_pct, " +
        "lining_m_comp5_label, lining_m_comp5_pct, " +
        "accessory_composition, cleaning_instruction, weight_g, hs_code, " +
        "main_m_quantity, lining_m_quantity, cost_eur_rate, retail_rate, " +
        "cutting_minutes, sewing_minutes, knitting_minutes, " +
        "thread_minutes, finish_minutes, packing_minutes, " +
        "main_mat:materials!main_material_id(material_number, set_price_jpy, unit_type), " +
        "lining_mat:materials!lining_material_id(material_number, set_price_jpy, unit_type)"
      )
      .eq("id", id)
      .single(),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("products").select("model_name").not("model_name", "is", null),
    supabase.from("materials").select(MATERIAL_SELECT).order("name"),
    supabase
      .from("product_colors")
      .select("id, material_color_id, markup_rate, retail_rate, retail_price_eur, sort_order, material_colors(color, set_price_jpy)")
      .eq("product_id", id)
      .order("sort_order"),
    supabase.from("product_materials").select("material_id, usage_amount, material_group").eq("product_id", id),
    supabase.from("company_settings").select("labor_rate_jpy_per_hour, cost_eur_rate_default").single(),
    getFormOptions(supabase),
    supabase.from("product_tags").select("tag").eq("product_id", id),
    getManufacturingPresets(supabase),
    supabase.from("product_images").select("id, product_color_id, web_url, thumb_url, sort_order").eq("product_id", id).order("sort_order"),
    loadModelsForPicker(supabase),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = productResult.data as any;
  if (!p?.id) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allMaterials = (materialsResult.data ?? []) as any[];
  const findMaterialNumber = (mid: string | null | undefined): string | null =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mid ? (allMaterials.find((m: any) => m.id === mid)?.material_number ?? null) : null;

  const pastModelNames = Array.from(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Set((pastModelsResult.data ?? []).map((r: any) => r.model_name).filter(Boolean))
  ) as string[];

  const mainBaseSetPrice = Number(p.main_mat?.set_price_jpy ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colors = (productColorsResult.data ?? []).map((pc: any) => ({
    productColorId:  pc.id as string,
    materialColorId: pc.material_color_id as string,
    color:           pc.material_colors?.color ?? "—",
    mainSetPriceJpy: pc.material_colors?.set_price_jpy != null ? Number(pc.material_colors.set_price_jpy) : mainBaseSetPrice,
    markupRate:      Number(pc.markup_rate ?? 3.0),
    retailRate:      Number(pc.retail_rate ?? 3.5),
    retailPriceEur:  Number(pc.retail_price_eur ?? 0),
  }));

  const mainMaterial = p.main_material_id && p.main_m_name
    ? { id: p.main_material_id, materialNumber: p.main_mat?.material_number ?? null, name: p.main_m_name,
        color: p.main_m_color ?? null, setPriceJpy: Number(p.main_mat?.set_price_jpy ?? 0), unitType: p.main_mat?.unit_type ?? null }
    : null;
  const liningMaterial = p.lining_material_id && p.lining_m_name
    ? { id: p.lining_material_id, materialNumber: p.lining_mat?.material_number ?? null, name: p.lining_m_name,
        color: p.lining_m_color ?? null, setPriceJpy: Number(p.lining_mat?.set_price_jpy ?? 0), unitType: p.lining_mat?.unit_type ?? null }
    : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialAdditionalRows = (productMaterialsResult.data ?? []).map((pm: any) => ({
    materialId: pm.material_id, quantity: Number(pm.usage_amount), role: pm.material_group ?? "accessories",
  }));

  return {
    id: p.id,
    status: p.status ?? "draft",
    locked: p.status === "final",
    productName: p.model_name ?? "",
    // ProductForm props
    seasons: seasonsResult.data ?? [],
    materials: allMaterials,
    models,
    pastModelNames,
    categoryOptions: formOptions.productCategory,
    sexOptions: formOptions.productSex,
    tagOptions: formOptions.productTag,
    accessoryCompositionOptions: formOptions.productAccessoryComposition,
    initialData: {
      season_id:            p.season_id,
      model_name:           p.model_name ?? "",
      model_id:             p.model_id ?? null,
      model_version_id:     p.model_version_id ?? null,
      product_category:     p.product_category ?? undefined,
      product_sex:          p.product_sex ?? undefined,
      is_sample:            p.is_sample,
      is_invalid:           p.is_invalid,
      orderable_sizes:      p.orderable_sizes ?? null,
      main_material_id:     p.main_material_id ?? undefined,
      main_m_category:      p.main_m_category ?? undefined,
      main_m_name:          p.main_m_name ?? undefined,
      main_m_color:         p.main_m_color ?? undefined,
      main_m_comp1_label:   p.main_m_comp1_label ?? undefined,
      main_m_comp1_pct:     p.main_m_comp1_pct ?? undefined,
      main_m_comp2_label:   p.main_m_comp2_label ?? undefined,
      main_m_comp2_pct:     p.main_m_comp2_pct ?? undefined,
      main_m_comp3_label:   p.main_m_comp3_label ?? undefined,
      main_m_comp3_pct:     p.main_m_comp3_pct ?? undefined,
      main_m_comp4_label:   p.main_m_comp4_label ?? undefined,
      main_m_comp4_pct:     p.main_m_comp4_pct ?? undefined,
      main_m_comp5_label:   p.main_m_comp5_label ?? undefined,
      main_m_comp5_pct:     p.main_m_comp5_pct ?? undefined,
      lining_material_id:   p.lining_material_id ?? undefined,
      lining_m_category:    p.lining_m_category ?? undefined,
      lining_m_name:        p.lining_m_name ?? undefined,
      lining_m_color:       p.lining_m_color ?? undefined,
      lining_m_comp1_label: p.lining_m_comp1_label ?? undefined,
      lining_m_comp1_pct:   p.lining_m_comp1_pct ?? undefined,
      lining_m_comp2_label: p.lining_m_comp2_label ?? undefined,
      lining_m_comp2_pct:   p.lining_m_comp2_pct ?? undefined,
      lining_m_comp3_label: p.lining_m_comp3_label ?? undefined,
      lining_m_comp3_pct:   p.lining_m_comp3_pct ?? undefined,
      lining_m_comp4_label: p.lining_m_comp4_label ?? undefined,
      lining_m_comp4_pct:   p.lining_m_comp4_pct ?? undefined,
      lining_m_comp5_label: p.lining_m_comp5_label ?? undefined,
      lining_m_comp5_pct:   p.lining_m_comp5_pct ?? undefined,
      accessory_composition:  p.accessory_composition ?? undefined,
      main_material_number:   findMaterialNumber(p.main_material_id),
      lining_material_number: findMaterialNumber(p.lining_material_id),
      lining_material_color_id: p.lining_material_color_id ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enabled_color_ids:      (productColorsResult.data ?? []).map((r: any) => r.material_color_id as string),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tags:                   (tagsResult.data ?? []).map((r: any) => r.tag as string),
    },
    // ProductCostForm props
    productCategory: p.product_category ?? null,
    productSex: p.product_sex ?? null,
    mainMaterial,
    liningMaterial,
    initialMainQuantity: Number(p.main_m_quantity ?? 0),
    initialLiningQuantity: Number(p.lining_m_quantity ?? 0),
    initialAdditionalRows,
    initialManufacturing: {
      cutting:  Number(p.cutting_minutes),
      sewing:   Number(p.sewing_minutes),
      knitting: Number(p.knitting_minutes),
      thread:   Number(p.thread_minutes),
      finish:   Number(p.finish_minutes),
      packing:  Number(p.packing_minutes),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    laborRate: Number((settingsResult.data as any)?.labor_rate_jpy_per_hour) || 2000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialCostEurRate: Number(p.cost_eur_rate) || Number((settingsResult.data as any)?.cost_eur_rate_default) || 130,
    // Retail multiplier captured on this product (retail = Ideal WS × multiplier).
    retailMultiplier: Number(p.retail_rate) > 1 ? Number(p.retail_rate) : 1 / (1 - 0.65),
    colors,
    presets: mfgPresets,
    // Photos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    photoColors: (productColorsResult.data ?? []).map((c: any) => ({ id: c.id as string, color: c.material_colors?.color ?? "—" })),
    images: imagesResult.data ?? [],
    // Care & Logistics
    careCleaningInstruction: p.cleaning_instruction ?? null,
    careWeightG: p.weight_g ?? null,
    careHsCode: p.hs_code ?? null,
    mainComp1Label: p.main_m_comp1_label ?? null,
  };
}
