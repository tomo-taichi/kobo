"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProductEditBundle } from "@/lib/product-edit-data";

function num(v: FormDataEntryValue | null): number | null {
  const s = (v as string)?.trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function computeName(modelName: string | null, mainMName: string | null, mainMColor: string | null): string {
  return [modelName, mainMName, mainMColor].filter(Boolean).join(" / ");
}

function parseEnabledColorIds(formData: FormData): string[] {
  try {
    const raw = formData.get("enabled_color_ids") as string;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === "string" && x) : [];
  } catch {
    return [];
  }
}

// Applied product tags (JSON array of tag strings from the managed vocabulary).
function parseTags(formData: FormData): string[] {
  try {
    const raw = formData.get("tags") as string;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? Array.from(new Set(arr.filter((x: any) => typeof x === "string" && x))) : [];
  } catch {
    return [];
  }
}

// Replace the product's tags with the given set (product_tags join).
async function syncProductTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  tags: string[]
): Promise<string | null> {
  const { error: delErr } = await supabase.from("product_tags").delete().eq("product_id", productId);
  if (delErr) return delErr.message;
  if (tags.length > 0) {
    const { error } = await supabase.from("product_tags").insert(tags.map((tag) => ({ product_id: productId, tag })));
    if (error) return error.message;
  }
  return null;
}

// Orderable sizes are a JSON array of size strings (subset of SIZES). Stored as text[].
function parseOrderableSizes(formData: FormData): string[] {
  try {
    const raw = formData.get("orderable_sizes") as string;
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === "string" && x) : [];
  } catch {
    return [];
  }
}

// Sync the product's enabled MAIN-material colours (product_colors). New colours copy
// the product's current price stack as a starting point (the cost form refines them
// per colour). Disabled colours are removed unless an order references them.
async function syncProductColors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  enabledColorIds: string[]
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("product_colors")
    .select("id, material_color_id")
    .eq("product_id", productId);
  const existingIds = new Set((existing ?? []).map((r: any) => r.material_color_id));
  const enabled = new Set(enabledColorIds);

  const toDelete = (existing ?? []).filter((r: any) => !enabled.has(r.material_color_id)).map((r: any) => r.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("product_colors").delete().in("id", toDelete);
    if (error) return "Cannot remove a colour that is already used by an order.";
  }

  const toAdd = enabledColorIds.filter((mcId) => !existingIds.has(mcId));
  if (toAdd.length > 0) {
    const { data: p } = await supabase
      .from("products")
      .select("material_cost_jpy, cost_jpy, cost_eur, markup_rate, wholesale_eur, retail_rate, retail_price_eur")
      .eq("id", productId)
      .single();
    const s: any = p ?? {};
    const rows = toAdd.map((mcId, i) => ({
      product_id: productId,
      material_color_id: mcId,
      material_cost_jpy: Number(s.material_cost_jpy ?? 0),
      cost_jpy: Number(s.cost_jpy ?? 0),
      cost_eur: Number(s.cost_eur ?? 0),
      markup_rate: Number(s.markup_rate ?? 3.0),
      wholesale_eur: Number(s.wholesale_eur ?? 0),
      retail_rate: Number(s.retail_rate ?? 3.5),
      retail_price_eur: Number(s.retail_price_eur ?? 0),
      sort_order: existingIds.size + i,
    }));
    const { error } = await supabase.from("product_colors").insert(rows);
    if (error) return error.message;
  }
  return null;
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
    orderable_sizes:      parseOrderableSizes(formData),
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
    lining_material_color_id: (formData.get("lining_material_color_id") as string) || null,
    // Accessory
    accessory_composition: (formData.get("accessory_composition") as string) || null,
    // Logistics
    cleaning_instruction:  (formData.get("cleaning_instruction") as string) || null,
    weight_g:              num(formData.get("weight_g")),
    hs_code:               (formData.get("hs_code") as string)?.trim() || null,
  };
}

// ADR-0011 Phase 3a — link a product to a Model + Version from its (name, category, season).
// Find-or-create the Model (identity = name+category); pick the version for the product's
// season (else the model's latest); create an active version if the model has none.
// Season ordering has no cross-format helper yet, so "latest" = most recently created.
async function resolveModelVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string | null,
  category: string | null,
  seasonId: string | null
): Promise<{ model_id: string | null; model_version_id: string | null }> {
  if (!name || !category) return { model_id: null, model_version_id: null };

  // Match by NORMALIZED name (case/space-insensitive) within the category, so we reuse the
  // merge survivor instead of re-creating a case-variant duplicate. Only create if truly new.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const target = norm(name);
  const { data: candidates } = await supabase.from("models").select("id, name").eq("category", category);
  let modelId = ((candidates ?? []) as { id: string; name: string }[]).find((m) => norm(m.name) === target)?.id ?? null;
  if (!modelId) {
    const { data: created, error } = await supabase.from("models").insert({ name, category }).select("id").single();
    if (error || !created) return { model_id: null, model_version_id: null };
    modelId = (created as { id: string }).id;
  }

  let versionId: string | null = null;
  if (seasonId) {
    const { data: sv } = await supabase.from("model_versions").select("id").eq("model_id", modelId).eq("season_id", seasonId).order("created_at", { ascending: false }).limit(1);
    versionId = ((sv ?? []) as { id: string }[])[0]?.id ?? null;
  }
  if (!versionId) {
    const { data: latest } = await supabase.from("model_versions").select("id").eq("model_id", modelId).order("created_at", { ascending: false }).limit(1);
    versionId = ((latest ?? []) as { id: string }[])[0]?.id ?? null;
  }
  if (!versionId && seasonId) {
    const { data: nv } = await supabase.from("model_versions").insert({ model_id: modelId, season_id: seasonId, status: "active" }).select("id").single();
    versionId = (nv as { id: string } | null)?.id ?? null;
  }
  return { model_id: modelId, model_version_id: versionId };
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
  // Capture the client discount as this product's retail multiplier (retail =
  // Ideal WS × multiplier). Prefer the SEASON's discount (like the season's EUR
  // rate), falling back to the company default. Later changes won't affect it.
  const { data: season } = await supabase.from("seasons").select("client_discount_rate").eq("id", fields.season_id).maybeSingle();
  let d = Number((season as { client_discount_rate?: number } | null)?.client_discount_rate);
  if (!(d >= 0 && d < 1)) {
    const { data: cs } = await supabase.from("company_settings").select("client_discount_rate").limit(1).maybeSingle();
    d = Number((cs as { client_discount_rate?: number } | null)?.client_discount_rate);
  }
  const retailMultiplier = d >= 0 && d < 1 ? 1 / (1 - d) : 1 / (1 - 0.65);
  // ADR-0011 Phase 3b — the form's Model/Version picker supplies the link explicitly. Fall
  // back to resolve-by-name only when it didn't (safety net for the ~40 spelling variants).
  const formModelId = (formData.get("model_id") as string) || null;
  const link = formModelId
    ? { model_id: formModelId, model_version_id: (formData.get("model_version_id") as string) || null }
    : await resolveModelVersion(supabase, fields.model_name, fields.product_category, fields.season_id);
  const { data, error } = await supabase.from("products").insert({ ...fields, product_number: productNumber, retail_rate: retailMultiplier, ...link }).select("id").single();
  if (error) return error.message;
  const syncErr = await syncProductColors(supabase, data.id, parseEnabledColorIds(formData));
  if (syncErr) return syncErr;
  await syncProductTags(supabase, data.id, parseTags(formData));
  revalidatePath("/products");
  redirect(`/products/${data.id}/edit`);
}

export async function updateProduct(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  // Finalised products are locked — reject edits (the UI also disables the form).
  const { data: cur } = await supabase.from("products").select("status").eq("id", id).single();
  if ((cur as { status?: string } | null)?.status === "final") return "Product is finalised — unlock to edit.";
  const fields = extractProductFields(formData);
  if (!fields.season_id)        return "Season is required";
  if (!fields.model_name)       return "Model name is required";
  // Main material is NOT required on edit — some imported products lack one, and
  // basic info (Category/Sex/etc.) must still be editable. It stays required to
  // *create* a product (enforced in the form + createProduct).
  // ADR-0011 Phase 3b — apply the picker's explicit Model/Version link on edit (Phase 3a left
  // updateProduct untouched). Only when the form provides a model_id, so any legacy caller that
  // doesn't render the picker keeps its existing link.
  const formModelId = (formData.get("model_id") as string) || null;
  const patch = formModelId
    ? { ...fields, model_id: formModelId, model_version_id: (formData.get("model_version_id") as string) || null }
    : fields;
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return error.message;
  const syncErr = await syncProductColors(supabase, id, parseEnabledColorIds(formData));
  if (syncErr) return syncErr;
  const tagErr = await syncProductTags(supabase, id, parseTags(formData));
  if (tagErr) return tagErr;
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
  "is_sample", "is_invalid", "orderable_sizes", "cleaning_instruction", "weight_g", "hs_code",
  "main_material_id", "main_m_category", "main_m_name", "main_m_color",
  "main_m_comp1_label", "main_m_comp1_pct", "main_m_comp2_label", "main_m_comp2_pct",
  "main_m_comp3_label", "main_m_comp3_pct", "main_m_comp4_label", "main_m_comp4_pct",
  "main_m_comp5_label", "main_m_comp5_pct",
  "main_m_quantity",
  "lining_material_id", "lining_m_category", "lining_m_name", "lining_m_color",
  "lining_m_comp1_label", "lining_m_comp1_pct", "lining_m_comp2_label", "lining_m_comp2_pct",
  "lining_m_comp3_label", "lining_m_comp3_pct", "lining_m_comp4_label", "lining_m_comp4_pct",
  "lining_m_comp5_label", "lining_m_comp5_pct",
  "lining_m_quantity", "lining_material_color_id",
  "accessory_composition",
  "model_id", "model_version_id",
  "cost_eur_rate", "markup_rate", "retail_rate", "retail_price_eur",
  "cutting_cost_jpy", "sewing_cost_jpy", "knitting_cost_jpy",
  "thread_cost_jpy", "finish_cost_jpy", "packing_cost_jpy",
  "cutting_minutes", "sewing_minutes", "knitting_minutes",
  "thread_minutes", "finish_minutes", "packing_minutes",
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

// (Per-product retail/margin inline editing was removed — pricing is now per colour,
// edited in the product's cost form. See product_colors / updateProductCosts.)

export async function deleteProduct(productId: string): Promise<string | null> {
  const supabase = await createClient();
  // product_materials cascade-deletes automatically (ON DELETE CASCADE)
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) return error.message;
  revalidatePath("/products");
  redirect("/products");
}

// ─── Bulk actions (products list) ────────────────────────────────────
export async function bulkArchiveProducts(ids: string[], archived: boolean): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_invalid: archived }).in("id", ids);
  if (error) return error.message;
  revalidatePath("/products");
  return null;
}

export async function bulkDeleteProducts(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) {
    if (error.code === "23503") return "Some products are used by orders and can't be deleted.";
    return error.message;
  }
  revalidatePath("/products");
  return null;
}

// Full edit bundle for the products-list popup (same data as the /edit page).
export async function getProductEditData(id: string) {
  const supabase = await createClient();
  return loadProductEditBundle(supabase, id);
}

// Quick inline edit from the products list: set one retail price across every colour
// of the product (uniform). Blocked when the product is finalised (locked).
export async function setProductRetailPrice(productId: string, retailEur: number): Promise<string | null> {
  if (isNaN(retailEur) || retailEur < 0) return "Invalid price";
  const supabase = await createClient();
  const { data: cur } = await supabase.from("products").select("status").eq("id", productId).single();
  if ((cur as { status?: string } | null)?.status === "final") return "Product is finalised — unlock to edit.";
  const { error: cErr } = await supabase.from("product_colors").update({ retail_price_eur: retailEur }).eq("product_id", productId);
  if (cErr) return cErr.message;
  const { error: pErr } = await supabase.from("products").update({ retail_price_eur: retailEur }).eq("id", productId);
  if (pErr) return pErr.message;
  revalidatePath("/products");
  return null;
}

// Quick inline edit from the products list: set the markup rate across every colour
// (uniform) and recompute each colour's Ideal WS € (= Cost € × markup). Cost € is
// derived from the stored Ideal WS ÷ current markup, so the full cost calc isn't
// re-run. Blocked when the product is finalised (locked).
export async function setProductMarkup(productId: string, markup: number): Promise<string | null> {
  if (isNaN(markup) || markup < 0) return "Invalid markup";
  const supabase = await createClient();
  const { data: cur } = await supabase.from("products").select("status, markup_rate, wholesale_eur").eq("id", productId).single();
  const c0 = cur as { status?: string; markup_rate?: number | null; wholesale_eur?: number | null } | null;
  if (c0?.status === "final") return "Product is finalised — unlock to edit.";

  const { data: colors } = await supabase.from("product_colors").select("id, markup_rate, wholesale_eur").eq("product_id", productId);
  for (const c of (colors ?? []) as { id: string; markup_rate: number | null; wholesale_eur: number | null }[]) {
    const oldM = Number(c.markup_rate ?? 0), oldWs = Number(c.wholesale_eur ?? 0);
    const costEur = oldM > 0 ? oldWs / oldM : null;
    const newWs = costEur != null ? Number((costEur * markup).toFixed(2)) : oldWs;
    const { error } = await supabase.from("product_colors").update({ markup_rate: markup, wholesale_eur: newWs }).eq("id", c.id);
    if (error) return error.message;
  }
  const baseM = Number(c0?.markup_rate ?? 0), baseWs = Number(c0?.wholesale_eur ?? 0);
  const baseCostEur = baseM > 0 ? baseWs / baseM : null;
  const baseNewWs = baseCostEur != null ? Number((baseCostEur * markup).toFixed(2)) : baseWs;
  const { error: pErr } = await supabase.from("products").update({ markup_rate: markup, wholesale_eur: baseNewWs }).eq("id", productId);
  if (pErr) return pErr.message;
  revalidatePath("/products");
  return null;
}

// Complete Status: finalise (lock) or unlock (back to draft) a single product.
export async function setProductFinalized(id: string, finalized: boolean): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: finalized ? "final" : "draft", finalized_at: finalized ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return error.message;
  revalidatePath(`/products/${id}/edit`);
  revalidatePath("/products");
  return null;
}

// Bulk finalise/unlock from the products list.
export async function bulkSetProductFinalized(ids: string[], finalized: boolean): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: finalized ? "final" : "draft", finalized_at: finalized ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) return error.message;
  revalidatePath("/products");
  return null;
}

// Add or remove one tag across many products.
export async function bulkSetProductTag(ids: string[], tag: string, add: boolean): Promise<string | null> {
  if (!ids.length || !tag) return null;
  const supabase = await createClient();
  if (add) {
    const rows = ids.map((product_id) => ({ product_id, tag }));
    const { error } = await supabase.from("product_tags").upsert(rows, { onConflict: "product_id,tag", ignoreDuplicates: true });
    if (error) return error.message;
  } else {
    const { error } = await supabase.from("product_tags").delete().eq("tag", tag).in("product_id", ids);
    if (error) return error.message;
  }
  revalidatePath("/products");
  return null;
}
