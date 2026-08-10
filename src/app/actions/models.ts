"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODEL_CATEGORIES, MODEL_VERSION_MATERIAL_ROLES, type ModelVersionMaterialRole } from "@/lib/model-constants";
import { getMaterialRoleLabels } from "@/lib/material-roles";
import type { ModelVersionEditBundle } from "@/components/model-version-editor";

// Shared with the version editor: one materials query covering picker + colours + set price.
const MV_MATERIAL_SELECT =
  "id, name, color, category, material_number, set_price_jpy, unit_type, " +
  "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
  "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, " +
  "colors:material_colors(id, color), seasons(name)";

// Load everything the version-edit popup needs (version recipe + materials catalogue +
// labor rate). Returns null when the version doesn't exist.
export async function getModelVersionEditData(versionId: string): Promise<ModelVersionEditBundle | null> {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("model_versions")
    .select(
      "id, model_id, status, changelog, orderable_sizes, accessory_composition, " +
        "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, seasons(name)"
    )
    .eq("id", versionId)
    .single();
  if (!version) return null;
  const v = version as unknown as {
    id: string; model_id: string; status: string; changelog: string | null;
    orderable_sizes: string[] | null; accessory_composition: string | null;
    cutting_minutes: number; sewing_minutes: number; knitting_minutes: number;
    thread_minutes: number; finish_minutes: number; packing_minutes: number;
    seasons: { name: string } | { name: string }[] | null;
  };

  const [{ data: model }, { data: matRows }, { data: materials }, { data: settings }, { count: productCount }, roleLabels] =
    await Promise.all([
      supabase.from("models").select("id, name, category").eq("id", v.model_id).single(),
      supabase
        .from("model_version_materials")
        .select("role, material_id, material_color_id, usage_amount, sort_order")
        .eq("model_version_id", versionId)
        .order("sort_order"),
      supabase.from("materials").select(MV_MATERIAL_SELECT).order("name"),
      supabase.from("company_settings").select("labor_rate_jpy_per_hour").single(),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("model_version_id", versionId),
      getMaterialRoleLabels(supabase),
    ]);
  if (!model) return null;
  const m = model as unknown as { name: string; category: string };
  const seasonName = Array.isArray(v.seasons) ? v.seasons[0]?.name : v.seasons?.name;

  return {
    data: {
      modelName: m.name,
      category: m.category,
      versionId: v.id,
      season: seasonName ?? "—",
      status: v.status,
      changelog: v.changelog ?? "",
      orderableSizes: v.orderable_sizes ?? [],
      accessoryComposition: v.accessory_composition ?? "",
      minutes: {
        cutting: Number(v.cutting_minutes),
        sewing: Number(v.sewing_minutes),
        knitting: Number(v.knitting_minutes),
        thread: Number(v.thread_minutes),
        finish: Number(v.finish_minutes),
        packing: Number(v.packing_minutes),
      },
      materials: ((matRows ?? []) as unknown as {
        role: string; material_id: string; material_color_id: string | null; usage_amount: number;
      }[]).map((mm) => ({
        role: mm.role,
        material_id: mm.material_id,
        material_color_id: mm.material_color_id,
        usage_amount: Number(mm.usage_amount),
      })),
      productCount: productCount ?? 0,
    },
    materials: (materials ?? []) as unknown as ModelVersionEditBundle["materials"],
    laborRate: Number((settings as { labor_rate_jpy_per_hour: number } | null)?.labor_rate_jpy_per_hour) || 2000,
    roleLabels,
  };
}

// Delete a version. Guard: refuse if any Product references it (products FK is ON DELETE
// SET NULL, so a delete would silently unlink them — we block instead, per "never lose data").
// model_version_materials cascade-delete with the version.
export async function deleteModelVersion(versionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: ver } = await supabase.from("model_versions").select("id, model_id").eq("id", versionId).single();
  if (!ver) return "Version not found.";
  const modelId = (ver as unknown as { model_id: string }).model_id;
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("model_version_id", versionId);
  if ((count ?? 0) > 0) return `This version is used by ${count} product(s) — it can't be deleted.`;
  const { error } = await supabase.from("model_versions").delete().eq("id", versionId);
  if (error) return error.message;
  revalidatePath("/models");
  revalidatePath(`/models/${modelId}`);
  return null;
}

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

  revalidatePath("/models");
  revalidatePath(`/models/${ver.model_id}`);
  return null; // popup handles close + refresh
}

// Copy-forward: create a new ACTIVE version for a target season, cloning an existing
// version's shared recipe + mfg template + non-main materials (ADR-0011 §3.1). Backfilled
// versions are all frozen, so this is how an editable version first comes to exist.
export async function createModelVersionCopyForward(
  modelId: string,
  seasonId: string,
  sourceVersionId: string
): Promise<{ versionId: string } | { error: string }> {
  if (!seasonId) return { error: "Please choose a target season." };
  if (!sourceVersionId) return { error: "Please choose a version to copy from." };
  const supabase = await createClient();

  const { data: src, error: sErr } = await supabase
    .from("model_versions")
    .select(
      "model_id, orderable_sizes, accessory_composition, " +
        "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes"
    )
    .eq("id", sourceVersionId)
    .single();
  if (sErr || !src) return { error: sErr?.message ?? "Source version not found." };
  const source = src as unknown as {
    model_id: string;
    orderable_sizes: string[] | null;
    accessory_composition: string | null;
    cutting_minutes: number; sewing_minutes: number; knitting_minutes: number;
    thread_minutes: number; finish_minutes: number; packing_minutes: number;
  };
  if (source.model_id !== modelId) return { error: "Source version belongs to a different model." };

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
    if (cErr.code === "23505") return { error: "An active version already exists for that season — edit it, or deprecate it first." };
    return { error: cErr.message };
  }
  const newId = (created as unknown as { id: string } | null)?.id;
  if (!newId) return { error: "Failed to create the version." };

  const { data: mats, error: mErr } = await supabase
    .from("model_version_materials")
    .select("role, material_id, material_color_id, usage_amount, sort_order")
    .eq("model_version_id", sourceVersionId)
    .order("sort_order");
  if (mErr) return { error: mErr.message };
  const srcMats = (mats ?? []) as unknown as {
    role: string; material_id: string; material_color_id: string | null; usage_amount: number; sort_order: number;
  }[];
  if (srcMats.length) {
    const { error: iErr } = await supabase
      .from("model_version_materials")
      .insert(srcMats.map((m) => ({ model_version_id: newId, ...m })));
    if (iErr) return { error: iErr.message };
  }

  revalidatePath("/models");
  revalidatePath(`/models/${modelId}`);
  return { versionId: newId }; // caller opens the new version's edit popup
}

// Merge one or more "loser" models into a survivor: reassign the losers' versions and
// default tags to the survivor, then delete the losers. Versions/products are preserved
// (products link via model_version_id, which is untouched). Guarded so it never creates
// two ACTIVE versions in one season for the survivor (partial unique).
export async function mergeModels(survivorId: string, loserIds: string[]): Promise<string | null> {
  const supabase = await createClient();
  const losers = Array.from(new Set(loserIds.filter((id) => id && id !== survivorId)));
  if (!losers.length) return "Pick at least one other model to merge into the survivor.";

  // Active-version-per-season guard across survivor + losers.
  const { data: av, error: avErr } = await supabase
    .from("model_versions")
    .select("season_id")
    .eq("status", "active")
    .in("model_id", [survivorId, ...losers]);
  if (avErr) return avErr.message;
  const seen = new Set<string>();
  for (const r of (av ?? []) as { season_id: string }[]) {
    if (seen.has(r.season_id)) return "Merge blocked: the survivor would end up with two active versions in one season. Deprecate/freeze one first.";
    seen.add(r.season_id);
  }

  // Reassign versions, the legacy products.model_id link, and default tags, then delete.
  const { error: vErr } = await supabase.from("model_versions").update({ model_id: survivorId }).in("model_id", losers);
  if (vErr) return vErr.message;
  const { error: pErr } = await supabase.from("products").update({ model_id: survivorId }).in("model_id", losers);
  if (pErr) return pErr.message;
  const { data: loserTags } = await supabase.from("model_tags").select("tag").in("model_id", losers);
  const tags = Array.from(new Set(((loserTags ?? []) as { tag: string }[]).map((t) => t.tag)));
  if (tags.length) {
    const { error: tErr } = await supabase
      .from("model_tags")
      .upsert(tags.map((tag) => ({ model_id: survivorId, tag })), { onConflict: "model_id,tag", ignoreDuplicates: true });
    if (tErr) return tErr.message;
  }
  const { error: dErr } = await supabase.from("models").delete().in("id", losers); // model_tags cascade; versions already moved
  if (dErr) return dErr.message;

  revalidatePath("/models");
  revalidatePath(`/models/${survivorId}`);
  return null;
}

// Duplicate a version into a new ACTIVE version for the SAME season (clones recipe +
// materials). Reuses copy-forward. Blocks (via the partial unique) if that season
// already has an active version — then use copy-forward to a different season.
export async function duplicateModelVersion(sourceVersionId: string): Promise<{ versionId: string } | { error: string }> {
  const supabase = await createClient();
  const { data: src } = await supabase
    .from("model_versions")
    .select("model_id, season_id")
    .eq("id", sourceVersionId)
    .single();
  if (!src) return { error: "Version not found." };
  const s = src as unknown as { model_id: string; season_id: string };
  return createModelVersionCopyForward(s.model_id, s.season_id, sourceVersionId);
}

// Save a Model's editable attributes + default tags in one call, WITHOUT redirecting
// (used by the list-page edit popup, which stays on /models). identity = (name, category).
export async function saveModel(id: string, name: string, category: string, tags: string[]): Promise<string | null> {
  const supabase = await createClient();
  const nm = name.trim();
  if (!nm) return "Please enter a model name";
  if (!MODEL_CATEGORIES.includes(category as (typeof MODEL_CATEGORIES)[number]))
    return "Please select a category";
  const { error } = await supabase.from("models").update({ name: nm, category }).eq("id", id);
  if (error) {
    if (error.code === "23505") return "A model with this name and category already exists.";
    return error.message;
  }
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const { error: dErr } = await supabase.from("model_tags").delete().eq("model_id", id);
  if (dErr) return dErr.message;
  if (clean.length) {
    const { error: iErr } = await supabase.from("model_tags").insert(clean.map((tag) => ({ model_id: id, tag })));
    if (iErr) return iErr.message;
  }
  revalidatePath("/models");
  revalidatePath(`/models/${id}`);
  return null;
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
