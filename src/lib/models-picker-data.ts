import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0011 Phase 3b/4 — the Product form's Model/Version picker needs a light catalogue of
// every Model with its Versions (id + season + status + whether the version has a recipe yet).
// `has_recipe` drives the "this Version has no recipe → edit it on the Model" guidance, which
// matters now that the create form no longer collects lining/sizes/composition (scope A).
export type PickerVersion = {
  id: string;
  season_id: string | null;
  season_name: string;
  status: string;
  has_recipe: boolean;
};
export type PickerModel = {
  id: string;
  name: string;
  category: string;
  versions: PickerVersion[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadModelsForPicker(supabase: SupabaseClient<any>): Promise<PickerModel[]> {
  const [{ data: models }, { data: versions }, { data: mats }] = await Promise.all([
    supabase.from("models").select("id, name, category").order("name"),
    supabase
      .from("model_versions")
      .select(
        "id, model_id, season_id, status, orderable_sizes, accessory_composition, " +
          "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, seasons(name)"
      ),
    supabase.from("model_version_materials").select("model_version_id"),
  ]);

  const withMaterials = new Set(((mats ?? []) as { model_version_id: string }[]).map((m) => m.model_version_id));
  const byModel = new Map<string, PickerVersion[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (versions ?? []) as any[]) {
    const seasonName = Array.isArray(v.seasons) ? v.seasons[0]?.name : v.seasons?.name;
    const minutes =
      Number(v.cutting_minutes ?? 0) + Number(v.sewing_minutes ?? 0) + Number(v.knitting_minutes ?? 0) +
      Number(v.thread_minutes ?? 0) + Number(v.finish_minutes ?? 0) + Number(v.packing_minutes ?? 0);
    const hasRecipe =
      withMaterials.has(v.id) || minutes > 0 || (v.orderable_sizes?.length ?? 0) > 0 || !!v.accessory_composition;
    const row: PickerVersion = {
      id: v.id,
      season_id: v.season_id,
      season_name: seasonName ?? "—",
      status: v.status,
      has_recipe: hasRecipe,
    };
    const list = byModel.get(v.model_id);
    if (list) list.push(row);
    else byModel.set(v.model_id, [row]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((models ?? []) as any[]).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    category: m.category as string,
    versions: (byModel.get(m.id) ?? []).sort((a, b) => a.season_name.localeCompare(b.season_name)),
  }));
}
