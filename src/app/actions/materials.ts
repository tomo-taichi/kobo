"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_CATEGORIES, UNIT_TYPES, MAX_COMPOSITIONS } from "@/lib/material-constants";

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
  const unit_price_jpy = Number(formData.get("unit_price_jpy"));
  const unit_type = formData.get("unit_type") as string;
  const supplier_id = (formData.get("supplier_id") as string) || null;
  const color = (formData.get("color") as string)?.trim() || null;
  const season_id = (formData.get("season_id") as string) || null;
  const set_price_jpy = Number(formData.get("set_price_jpy") ?? 0);

  if (!color) return "Colour is required";
  if (!season_id) return "Season is required";
  if (!MATERIAL_CATEGORIES.includes(category as typeof MATERIAL_CATEGORIES[number])) return "Please select a category";
  if (!UNIT_TYPES.includes(unit_type as typeof UNIT_TYPES[number])) return "Please select a unit";
  if (isNaN(unit_price_jpy) || unit_price_jpy < 0) return "Please enter a valid unit price";

  const material_number = await nextMaterialNumber(supabase);
  const compositions = extractCompositions(formData);
  const { error } = await supabase.from("materials").insert({
    name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, color, season_id, material_number, ...compositions,
  });
  if (error) return error.message;
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

export async function updateMaterial(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a material name";
  const category = formData.get("category") as string;
  const unit_price_jpy = Number(formData.get("unit_price_jpy"));
  const unit_type = formData.get("unit_type") as string;
  const supplier_id = (formData.get("supplier_id") as string) || null;
  const color = (formData.get("color") as string)?.trim() || null;
  const season_id = (formData.get("season_id") as string) || null;
  const set_price_jpy = Number(formData.get("set_price_jpy") ?? 0);

  const compositions = extractCompositions(formData);
  const { error } = await supabase.from("materials").update({
    name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, color, season_id, ...compositions,
  }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/materials");
  redirect("/materials");
}
