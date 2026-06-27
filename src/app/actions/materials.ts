"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_CATEGORIES, UNIT_TYPES, MAX_COMPOSITIONS } from "@/lib/material-constants";

type ColorInput = { color: string; unit_price_jpy: number | null; set_price_jpy: number | null };

function parseColors(formData: FormData): ColorInput[] {
  try {
    const raw = formData.get("colors_json") as string;
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c: any) => c && typeof c.color === "string" && c.color.trim())
      .map((c: any) => ({
        color: c.color.trim(),
        unit_price_jpy: c.unit_price_jpy == null || c.unit_price_jpy === "" ? null : Number(c.unit_price_jpy),
        set_price_jpy: c.set_price_jpy == null || c.set_price_jpy === "" ? null : Number(c.set_price_jpy),
      }));
  } catch {
    return [];
  }
}

// Upsert the material's colours; delete colours the user removed (unless a product
// still references them, in which case keep them and surface a friendly error).
async function syncMaterialColors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  materialId: string,
  colors: ColorInput[]
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("material_colors")
    .select("id, color")
    .eq("material_id", materialId);
  const keep = new Set(colors.map((c) => c.color));
  const toDelete = (existing ?? []).filter((r: any) => !keep.has(r.color)).map((r: any) => r.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("material_colors").delete().in("id", toDelete);
    if (error) return "Cannot remove a colour that is already used by a product.";
  }
  if (colors.length > 0) {
    const rows = colors.map((c, i) => ({
      material_id: materialId,
      color: c.color,
      unit_price_jpy: c.unit_price_jpy,
      set_price_jpy: c.set_price_jpy,
      sort_order: i,
    }));
    const { error } = await supabase.from("material_colors").upsert(rows, { onConflict: "material_id,color" });
    if (error) return error.message;
  }
  return null;
}

function extractCompositions(formData: FormData) {
  const result: Record<string, string | number | null> = {};
  for (let i = 1; i <= MAX_COMPOSITIONS; i++) {
    const label = (formData.get(`comp_${i}_label`) as string)?.trim() || null;
    const pctRaw = formData.get(`comp_${i}_pct`) as string;
    const pct = pctRaw ? Number(pctRaw) : null;
    result[`comp_${i}_label`] = label;
    result[`comp_${i}_pct`] = label && pct ? pct : null;
  }
  return result;
}

async function nextMaterialNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("materials").select("material_number").not("material_number", "is", null);
  const nums = (data ?? [])
    .map((r: any) => {
      const s: string = r.material_number ?? "";
      if (!s.startsWith("M")) return 0;
      return parseInt(s.slice(1), 10);
    })
    .filter((n: number) => !isNaN(n) && n > 0 && n <= 999999);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return "M" + String(max + 1).padStart(6, "0");
}

export async function createMaterial(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a material name";
  const category = formData.get("category") as string;
  const unit_type = formData.get("unit_type") as string;
  const supplier_id = (formData.get("supplier_id") as string) || null;
  const colors = parseColors(formData);
  const color = colors[0]?.color ?? null;                   // legacy primary colour
  const unit_price_jpy = colors[0]?.unit_price_jpy ?? 0;    // base = first colour (per-colour is authoritative)
  const set_price_jpy  = colors[0]?.set_price_jpy ?? 0;
  const season_id = (formData.get("season_id") as string) || null;

  if (colors.length === 0) return "At least one colour is required";
  if (!season_id) return "Season is required";
  if (!MATERIAL_CATEGORIES.includes(category as typeof MATERIAL_CATEGORIES[number])) return "Please select a category";
  if (!UNIT_TYPES.includes(unit_type as typeof UNIT_TYPES[number])) return "Please select a unit";

  const material_number = await nextMaterialNumber(supabase);
  const compositions = extractCompositions(formData);
  const { data: inserted, error } = await supabase.from("materials").insert({
    name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, color, season_id, material_number, ...compositions,
  }).select("id").single();
  if (error) return error.message;
  const syncErr = await syncMaterialColors(supabase, (inserted as { id: string }).id, colors);
  if (syncErr) return syncErr;
  revalidatePath("/materials");
  redirect("/materials");
}

export async function duplicateMaterial(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: src, error: fetchError } = await supabase
    .from("materials")
    .select("name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, season_id, color, comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, comp_4_label, comp_4_pct, comp_5_label, comp_5_pct")
    .eq("id", id)
    .single();
  if (fetchError || !src) return fetchError?.message ?? "Material not found";
  const material_number = await nextMaterialNumber(supabase);
  const { data: newRow, error: insertError } = await supabase
    .from("materials")
    .insert({ ...src, name: `${src.name} (copy)`, material_number })
    .select("id")
    .single();
  if (insertError || !newRow) return insertError?.message ?? "Insert failed";
  // Copy the source material's colours to the duplicate
  const { data: srcColors } = await supabase
    .from("material_colors")
    .select("color, unit_price_jpy, set_price_jpy, sort_order")
    .eq("material_id", id);
  if (srcColors && srcColors.length > 0) {
    await supabase.from("material_colors").insert(
      srcColors.map((c: any) => ({
        material_id: (newRow as { id: string }).id,
        color: c.color,
        unit_price_jpy: c.unit_price_jpy,
        set_price_jpy: c.set_price_jpy,
        sort_order: c.sort_order,
      }))
    );
  }
  revalidatePath("/materials");
  redirect(`/materials/${newRow.id}/edit`);
}

const INLINE_EDITABLE_FIELDS = ["name", "color", "category", "season_id", "unit_price_jpy", "set_price_jpy"] as const;
type InlineField = typeof INLINE_EDITABLE_FIELDS[number];

export async function updateMaterialField(
  id: string,
  field: InlineField,
  value: string
): Promise<string | null> {
  if (!INLINE_EDITABLE_FIELDS.includes(field)) return "Invalid field";
  const supabase = await createClient();
  let parsed: string | number | null = value.trim() || null;
  if (field === "unit_price_jpy" || field === "set_price_jpy") {
    const n = Number(value);
    if (isNaN(n) || n < 0) return "Invalid number";
    parsed = n;
  }
  if (field === "name" && !parsed) return "Name is required";
  const { error } = await supabase.from("materials").update({ [field]: parsed }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/materials");
  return null;
}

export async function updateMaterialSetPrice(id: string, set_price_jpy: number): Promise<string | null> {
  return updateMaterialField(id, "set_price_jpy", String(set_price_jpy));
}

// Inline edit (materials list) of the FIRST colour's Unit/Set price. Updates the first
// material_colors row and mirrors it onto the material's base column.
export async function updateMaterialFirstColorPrice(
  materialId: string,
  field: "unit_price_jpy" | "set_price_jpy",
  value: number
): Promise<string | null> {
  if (field !== "unit_price_jpy" && field !== "set_price_jpy") return "Invalid field";
  if (isNaN(value) || value < 0) return "Invalid number";
  const supabase = await createClient();
  const { error: baseErr } = await supabase.from("materials").update({ [field]: value }).eq("id", materialId);
  if (baseErr) return baseErr.message;
  const { data: first } = await supabase
    .from("material_colors").select("id").eq("material_id", materialId).order("sort_order").limit(1).maybeSingle();
  if (first) {
    const { error: colErr } = await supabase.from("material_colors").update({ [field]: value }).eq("id", (first as { id: string }).id);
    if (colErr) return colErr.message;
  }
  revalidatePath("/materials");
  return null;
}

// Shared update logic (no redirect/revalidate). Returns an error message, or null on success.
async function applyMaterialUpdate(formData: FormData): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a material name";
  const category = formData.get("category") as string;
  const unit_type = formData.get("unit_type") as string;
  const supplier_id = (formData.get("supplier_id") as string) || null;
  const colors = parseColors(formData);
  const color = colors[0]?.color ?? null;                   // legacy primary colour
  const unit_price_jpy = colors[0]?.unit_price_jpy ?? 0;    // base = first colour (per-colour is authoritative)
  const set_price_jpy  = colors[0]?.set_price_jpy ?? 0;
  const season_id = (formData.get("season_id") as string) || null;

  if (colors.length === 0) return "At least one colour is required";

  const compositions = extractCompositions(formData);
  const { error } = await supabase.from("materials").update({
    name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, color, season_id, ...compositions,
  }).eq("id", id);
  if (error) return error.message;
  return await syncMaterialColors(supabase, id, colors);
}

export async function updateMaterial(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const err = await applyMaterialUpdate(formData);
  if (err) return err;
  revalidatePath("/materials");
  redirect("/materials");
}

// Auto-save variant for the edit page: persists without navigating away.
export async function autosaveMaterial(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const err = await applyMaterialUpdate(formData);
  if (err) return err;
  revalidatePath("/materials");
  return "ok";
}
