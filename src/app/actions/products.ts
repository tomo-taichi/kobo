"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number | null {
  const s = (v as string)?.trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function computeName(modelName: string | null, mainMName: string | null, mainMColor: string | null): string {
  return [modelName, mainMName, mainMColor].filter(Boolean).join(" / ");
}

function extractProductFields(formData: FormData) {
  const model_name     = (formData.get("model_name") as string)?.trim() || null;
  const main_m_name    = (formData.get("main_m_name") as string)?.trim() || null;
  const main_m_color   = (formData.get("main_m_color") as string)?.trim() || null;
  return {
    name:                 computeName(model_name, main_m_name, main_m_color),
    season_id:            formData.get("season_id") as string,
    model_name,
    product_category:     (formData.get("product_category") as string) || null,
    product_sex:          (formData.get("product_sex") as string) || null,
    is_sample:            formData.get("is_sample") === "true",
    is_invalid:           formData.get("is_invalid") === "true",
    // Main material
    main_material_id:     (formData.get("main_material_id") as string) || null,
    main_m_category:      (formData.get("main_m_category") as string) || null,
    main_m_name,
    main_m_color,
    main_m_comp1_label:   (formData.get("main_m_comp1_label") as string) || null,
    main_m_comp1_pct:     num(formData.get("main_m_comp1_pct")),
    main_m_comp2_label:   (formData.get("main_m_comp2_label") as string) || null,
    main_m_comp2_pct:     num(formData.get("main_m_comp2_pct")),
    main_m_comp3_label:   (formData.get("main_m_comp3_label") as string) || null,
    main_m_comp3_pct:     num(formData.get("main_m_comp3_pct")),
    main_m_comp4_label:   (formData.get("main_m_comp4_label") as string) || null,
    main_m_comp4_pct:     num(formData.get("main_m_comp4_pct")),
    main_m_comp5_label:   (formData.get("main_m_comp5_label") as string) || null,
    main_m_comp5_pct:     num(formData.get("main_m_comp5_pct")),
    // Lining material
    lining_material_id:   (formData.get("lining_material_id") as string) || null,
    lining_m_category:    (formData.get("lining_m_category") as string) || null,
    lining_m_name:        (formData.get("lining_m_name") as string) || null,
    lining_m_color:       (formData.get("lining_m_color") as string) || null,
    lining_m_comp1_label: (formData.get("lining_m_comp1_label") as string) || null,
    lining_m_comp1_pct:   num(formData.get("lining_m_comp1_pct")),
    lining_m_comp2_label: (formData.get("lining_m_comp2_label") as string) || null,
    lining_m_comp2_pct:   num(formData.get("lining_m_comp2_pct")),
    lining_m_comp3_label: (formData.get("lining_m_comp3_label") as string) || null,
    lining_m_comp3_pct:   num(formData.get("lining_m_comp3_pct")),
    lining_m_comp4_label: (formData.get("lining_m_comp4_label") as string) || null,
    lining_m_comp4_pct:   num(formData.get("lining_m_comp4_pct")),
    lining_m_comp5_label: (formData.get("lining_m_comp5_label") as string) || null,
    lining_m_comp5_pct:   num(formData.get("lining_m_comp5_pct")),
    // Accessory
    accessory_composition: (formData.get("accessory_composition") as string) || null,
    // Logistics
    cleaning_instruction:  (formData.get("cleaning_instruction") as string) || null,
    weight_g:              num(formData.get("weight_g")),
    hs_code:               (formData.get("hs_code") as string)?.trim() || null,
  };
}

async function nextProductNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("products").select("product_number").not("product_number", "is", null);
  const nums = (data ?? [])
    .map((r: any) => parseInt((r.product_number ?? "").replace(/^P/i, ""), 10))
    .filter((n: number) => !isNaN(n) && n > 0 && n <= 999999);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return "P" + String(max + 1).padStart(6, "0");
}

export async function createProduct(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const fields = extractProductFields(formData);
  if (!fields.season_id)        return "Season is required";
  if (!fields.model_name)       return "Model name is required";
  if (!fields.main_material_id) return "Main material is required";
  const productNumber = await nextProductNumber(supabase);
  const { data, error } = await supabase.from("products").insert({ ...fields, product_number: productNumber }).select("id").single();
  if (error) return error.message;
  revalidatePath("/products");
  redirect(`/products/${data.id}/edit`);
}

export async function updateProduct(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const fields = extractProductFields(formData);
  if (!fields.season_id)        return "Season is required";
  if (!fields.model_name)       return "Model name is required";
  if (!fields.main_material_id) return "Main material is required";
  const { error } = await supabase.from("products").update(fields).eq("id", id);
  if (error) return error.message;
  revalidatePath(`/products/${id}/edit`);
  revalidatePath("/products");
  return "ok";
}

export async function updateProductCare(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const { error } = await supabase.from("products").update({
    cleaning_instruction: (formData.get("cleaning_instruction") as string) || null,
    weight_g:             num(formData.get("weight_g")),
    hs_code:              (formData.get("hs_code") as string)?.trim() || null,
  }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/products");
  return "ok";
}

export async function saveProductCare(
  productId: string,
  cleaningInstruction: string | null,
  weightG: number | null,
  hsCode: string | null,
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({
    cleaning_instruction: cleaningInstruction || null,
    weight_g:             weightG,
    hs_code:              hsCode?.trim() || null,
  }).eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  return null;
}

const DUPLICATE_FIELDS = [
  "season_id", "model_name", "product_category", "product_sex",
  "is_sample", "is_invalid", "cleaning_instruction", "weight_g", "hs_code",
  "main_material_id", "main_m_category", "main_m_name", "main_m_color",
  "main_m_comp1_label", "main_m_comp1_pct", "main_m_comp2_label", "main_m_comp2_pct",
  "main_m_comp3_label", "main_m_comp3_pct", "main_m_comp4_label", "main_m_comp4_pct",
  "main_m_comp5_label", "main_m_comp5_pct",
  "main_m_quantity",
  "lining_material_id", "lining_m_category", "lining_m_name", "lining_m_color",
  "lining_m_comp1_label", "lining_m_comp1_pct", "lining_m_comp2_label", "lining_m_comp2_pct",
  "lining_m_comp3_label", "lining_m_comp3_pct", "lining_m_comp4_label", "lining_m_comp4_pct",
  "lining_m_comp5_label", "lining_m_comp5_pct",
  "lining_m_quantity",
  "accessory_composition",
  "cost_eur_rate", "markup_rate", "retail_rate", "retail_price_eur",
  "cutting_cost_jpy", "sewing_cost_jpy", "knitting_cost_jpy",
  "thread_cost_jpy", "finish_cost_jpy", "packing_cost_jpy",
] as const;

export async function duplicateProduct(sourceId: string) {
  const supabase = await createClient();

  // Fetch product fields and product_materials in parallel
  const [srcResult, materialsResult] = await Promise.all([
    supabase.from("products").select(DUPLICATE_FIELDS.join(", ")).eq("id", sourceId).single(),
    supabase.from("product_materials").select("material_id, usage_amount, material_group").eq("product_id", sourceId),
  ]);
  if (!srcResult.data) return;
  const s = srcResult.data as any;
  const payload: any = {
    duplicated_from: sourceId,
    name: s.model_name ?? null,   // name without material until main material is selected
  };
  for (const f of DUPLICATE_FIELDS) payload[f] = s[f];

  // Clear main material — must be selected fresh on the duplicate
  payload.main_material_id = null;
  payload.main_m_category  = null;
  payload.main_m_name      = null;
  payload.main_m_color     = null;
  payload.main_m_quantity  = 0;
  for (let i = 1; i <= 5; i++) {
    payload[`main_m_comp${i}_label`] = null;
    payload[`main_m_comp${i}_pct`]   = null;
  }

  const { data: newProduct, error } = await supabase
    .from("products")
    .insert(payload)
    .select("id")
    .single();
  if (error || !newProduct) return;
  const newId = (newProduct as any).id;

  // Copy product_materials (Others section)
  const sourceMaterials = materialsResult.data ?? [];
  if (sourceMaterials.length > 0) {
    await supabase.from("product_materials").insert(
      sourceMaterials.map((m: any) => ({
        product_id:     newId,
        material_id:    m.material_id,
        usage_amount:   m.usage_amount,
        material_group: m.material_group,
      }))
    );
  }

  const productNumber = await nextProductNumber(supabase);
  await supabase.from("products").update({ product_number: productNumber }).eq("id", newId);
  revalidatePath("/products");
  redirect(`/products/${newId}/edit`);
}

// Inline edit of the manual retail price (the Order-adopted price) from the
// products list. retail_price_eur is set directly — no rate-based recompute.
export async function updateProductRetailPrice(
  productId: string,
  retailPriceEur: number
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({
    retail_price_eur: retailPriceEur,
  }).eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  return null;
}

// Inline edit of the Retail Margin Rate from the products list. Only retail_rate
// is updated — it drives the Retail (ref) suggestion and does NOT overwrite the
// manually-set retail_price_eur.
export async function updateProductRetailRate(
  productId: string,
  retailRate: number
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({
    retail_rate: retailRate,
  }).eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  return null;
}

export async function deleteProduct(productId: string): Promise<string | null> {
  const supabase = await createClient();
  // product_materials cascade-deletes automatically (ON DELETE CASCADE)
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  redirect("/products");
}
