"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODEL_CATEGORIES } from "@/lib/model-constants";

export async function createModel(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a model name";
  const category = formData.get("category") as string;
  if (!MODEL_CATEGORIES.includes(category as (typeof MODEL_CATEGORIES)[number]))
    return "Please select a category";
  // ADR-0011: identity = (name, category); sex lives on the Product, not the Model.
  const { error } = await supabase.from("models").insert({ name, category });
  if (error) {
    if (error.code === "23505") return "A model with this name and category already exists.";
    return error.message;
  }
  revalidatePath("/models");
  redirect("/models");
}

// List-page bulk actions (list-page default spec). Archive is the soft default.
export async function bulkArchiveModels(ids: string[], archived: boolean): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("models").update({ archived }).in("id", ids);
  if (error) return error.message;
  revalidatePath("/models");
  return null;
}

// Hard delete, but NEVER force it: a Model with any Version is FK-protected
// (model_versions.model_id is ON DELETE RESTRICT, and Products link via those
// versions). Skip blocked models and report — archive is the alternative.
export async function bulkDeleteModels(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { data: vers, error: vErr } = await supabase
    .from("model_versions")
    .select("model_id")
    .in("model_id", ids);
  if (vErr) return vErr.message;
  const blocked = new Set((vers ?? []).map((r: { model_id: string }) => r.model_id));
  const deletable = ids.filter((id) => !blocked.has(id));
  if (deletable.length) {
    const { error } = await supabase.from("models").delete().in("id", deletable);
    if (error) return error.message;
  }
  revalidatePath("/models");
  if (blocked.size)
    return `Deleted ${deletable.length}. Skipped ${blocked.size} — they still have versions (archive instead).`;
  return null;
}

export async function updateModel(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a model name";
  const category = formData.get("category") as string;
  if (!MODEL_CATEGORIES.includes(category as (typeof MODEL_CATEGORIES)[number]))
    return "Please select a category";
  // ADR-0011: a Model has only name + category; sex lives on the Product.
  const { error } = await supabase.from("models").update({ name, category }).eq("id", id);
  if (error) {
    if (error.code === "23505") return "A model with this name and category already exists.";
    return error.message;
  }
  revalidatePath("/models");
  revalidatePath(`/models/${id}`);
  redirect(`/models/${id}`);
}

// Default tags for the Model — copied into product_tags at product creation (Phase 3).
// Editing them here does NOT touch existing products' tags (those are Product-owned).
export async function setModelTags(modelId: string, tags: string[]): Promise<string | null> {
  const supabase = await createClient();
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const { error: dErr } = await supabase.from("model_tags").delete().eq("model_id", modelId);
  if (dErr) return dErr.message;
  if (clean.length) {
    const { error: iErr } = await supabase
      .from("model_tags")
      .insert(clean.map((tag) => ({ model_id: modelId, tag })));
    if (iErr) return iErr.message;
  }
  revalidatePath(`/models/${modelId}`);
  return null;
}
