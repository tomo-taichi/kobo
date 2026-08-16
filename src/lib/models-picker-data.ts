import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0011 Phase 3b — the Product form's Model/Version picker needs a light catalogue of
// every Model with its Versions (id + season + status). Selection only links ids here; the
// shared recipe/cost is surfaced by the Model detail card (Phase 3c), so this stays cheap.
export type PickerVersion = {
  id: string;
  season_id: string | null;
  season_name: string;
  status: string;
};
export type PickerModel = {
  id: string;
  name: string;
  category: string;
  versions: PickerVersion[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadModelsForPicker(supabase: SupabaseClient<any>): Promise<PickerModel[]> {
  const [{ data: models }, { data: versions }] = await Promise.all([
    supabase.from("models").select("id, name, category").order("name"),
    supabase.from("model_versions").select("id, model_id, season_id, status, seasons(name)"),
  ]);
  const byModel = new Map<string, PickerVersion[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of (versions ?? []) as any[]) {
    const seasonName = Array.isArray(v.seasons) ? v.seasons[0]?.name : v.seasons?.name;
    const row: PickerVersion = { id: v.id, season_id: v.season_id, season_name: seasonName ?? "—", status: v.status };
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
