"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODEL_CATEGORIES, MODEL_VERSION_MATERIAL_ROLES, type ModelVersionMaterialRole } from "@/lib/model-constants";

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

// Add or remove one default tag across many models. Mirrors bulkSetProductTag —
// same managed vocabulary (list_options domain 'product_tag').
export async function bulkSetModelTag(ids: string[], tag: string, add: boolean): Promise<string | null> {
  if (!ids.length || !tag) return null;
  const supabase = await createClient();
  if (add) {
    const rows = ids.map((model_id) => ({ model_id, tag }));
    const { error } = await supabase
      .from("model_tags")
      .upsert(rows, { onConflict: "model_id,tag", ignoreDuplicates: true });
    if (error) return error.message;
  } else {
    const { error } = await supabase.from("model_tags").delete().eq("tag", tag).in("model_id", ids);
    if (error) return error.message;
  }
  revalidatePath("/models");
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

export type VersionMaterialInput = {
  role: string;
  material_id: string;
  material_color_id: string | null;
  usage_amount: number;
};
export type UpdateVersionInput = {
  changelog: string | null;
  orderable_sizes: string[];
  accessory_composition: string | null;
  // Manufacturing template, in MINUTES (the client converts hours → minutes).
  minutes: { cutting: number; sewing: number; knitting: number; thread: number; finish: number; packing: number };
  materials: VersionMaterialInput[];
};

// Edit a Model Version's shared recipe (non-main materials + 用尺), orderable sizes,
// accessory composition, manufacturing-time template, and changelog. ONLY active
// versions are editable — frozen/deprecated are read-only (change via copy-forward).
export async function updateModelVersion(versionId: string, input: UpdateVersionInput): Promise<string | null> {
  const supabase = await createClient();
  const { data: ver, error: vErr } = await supabase
    .from("model_versions")
    .select("id, model_id, status")
    .eq("id", versionId)
    .single();
  if (vErr || !ver) return vErr?.message ?? "Version not found";
  if (ver.status !== "active")
    return `This version is ${ver.status} and can't be edited. Create a new version (copy-forward) to change the recipe.`;

  for (const m of input.materials) {
    if (!MODEL_VERSION_MATERIAL_ROLES.includes(m.role as ModelVersionMaterialRole))
      return `Invalid material role: ${m.role}`;
    if (!m.material_id) return "Each material row needs a material selected.";
    if (!(Number(m.usage_amount) >= 0)) return "Usage amount must be zero or more.";
  }

  const { error: uErr } = await supabase
    .from("model_versions")
    .update({
      changelog: input.changelog?.trim() || null,
      orderable_sizes: input.orderable_sizes,
      accessory_composition: input.accessory_composition?.trim() || null,
      cutting_minutes: input.minutes.cutting,
      sewing_minutes: input.minutes.sewing,
      knitting_minutes: input.minutes.knitting,
      thread_minutes: input.minutes.thread,
      finish_minutes: input.minutes.finish,
      packing_minutes: input.minutes.packing,
    })
    .eq("id", versionId);
  if (uErr) return uErr.message;

  // Replace the non-main material set (delete + insert, sort_order = array order).
  const { error: dErr } = await supabase.from("model_version_materials").delete().eq("model_version_id", versionId);
  if (dErr) return dErr.message;
  if (input.materials.length) {
    const rows = input.materials.map((m, i) => ({
      model_version_id: versionId,
      role: m.role,
      material_id: m.material_id,
      material_color_id: m.material_color_id,
      usage_amount: Number(m.usage_amount),
      sort_order: i,
    }));
    const { error: iErr } = await supabase.from("model_version_materials").insert(rows);
    if (iErr) return iErr.message;
  }

  revalidatePath(`/models/${ver.model_id}`);
  revalidatePath(`/models/${ver.model_id}/versions/${versionId}/edit`);
  redirect(`/models/${ver.model_id}`);
}

// Copy-forward: create a new ACTIVE version for a target season, cloning an existing
// version's shared recipe + mfg template + non-main materials (ADR-0011 §3.1). Backfilled
// versions are all frozen, so this is how an editable version first comes to exist.
export async function createModelVersionCopyForward(
  modelId: string,
  seasonId: string,
  sourceVersionId: string
): Promise<string | null> {
  if (!seasonId) return "Please choose a target season.";
  if (!sourceVersionId) return "Please choose a version to copy from.";
  const supabase = await createClient();

  const { data: src, error: sErr } = await supabase
    .from("model_versions")
    .select(
      "model_id, orderable_sizes, accessory_composition, " +
        "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes"
    )
    .eq("id", sourceVersionId)
    .single();
  if (sErr || !src) return sErr?.message ?? "Source version not found.";
  const source = src as unknown as {
    model_id: string;
    orderable_sizes: string[] | null;
    accessory_composition: string | null;
    cutting_minutes: number; sewing_minutes: number; knitting_minutes: number;
    thread_minutes: number; finish_minutes: number; packing_minutes: number;
  };
  if (source.model_id !== modelId) return "Source version belongs to a different model.";

  const { data: created, error: cErr } = await supabase
    .from("model_versions")
    .insert({
      model_id: modelId,
      season_id: seasonId,
      status: "active",
      changelog: null,
      orderable_sizes: source.orderable_sizes ?? [],
      accessory_composition: source.accessory_composition,
      cutting_minutes: source.cutting_minutes,
      sewing_minutes: source.sewing_minutes,
      knitting_minutes: source.knitting_minutes,
      thread_minutes: source.thread_minutes,
      finish_minutes: source.finish_minutes,
      packing_minutes: source.packing_minutes,
    })
    .select("id")
    .single();
  if (cErr) {
    // Partial unique (model_id, season_id) WHERE status='active'.
    if (cErr.code === "23505") return "An active version already exists for that season — edit it, or deprecate it first.";
    return cErr.message;
  }
  const newId = (created as unknown as { id: string } | null)?.id;
  if (!newId) return "Failed to create the version.";

  const { data: mats, error: mErr } = await supabase
    .from("model_version_materials")
    .select("role, material_id, material_color_id, usage_amount, sort_order")
    .eq("model_version_id", sourceVersionId)
    .order("sort_order");
  if (mErr) return mErr.message;
  const srcMats = (mats ?? []) as unknown as {
    role: string; material_id: string; material_color_id: string | null; usage_amount: number; sort_order: number;
  }[];
  if (srcMats.length) {
    const { error: iErr } = await supabase
      .from("model_version_materials")
      .insert(srcMats.map((m) => ({ model_version_id: newId, ...m })));
    if (iErr) return iErr.message;
  }

  revalidatePath(`/models/${modelId}`);
  redirect(`/models/${modelId}/versions/${newId}/edit`);
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
