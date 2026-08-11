import type { SupabaseClient } from "@supabase/supabase-js";

// One computed row per Model Version, shared by the Model detail page and the Models
// list expansion (via VersionsTable). Costs exclude the per-Product main material.
export type VersionRow = {
  id: string;
  model_id: string;
  season: string;
  status: string;
  changelog: string | null;
  sizes_count: number;
  accessory_composition: string | null;
  updated_at: string;
  product_count: number;
  material_count: number;
  lining_label: string; // lining material name, or "None"
  total_cost: number; // non-main materials (set_price × usage) + manufacturing (¥)
  mfg_hours: number;
};

// Load computed VersionRow[] for the given version ids (season-sorted). Joins
// materials for lining + cost, folds product/material counts, reads the labor rate.
export async function loadVersionRows(supabase: SupabaseClient, versionIds: string[]): Promise<VersionRow[]> {
  if (!versionIds.length) return [];

  type MatEmbed = { name: string; set_price_jpy: number | null };
  type MatRow = { model_version_id: string; role: string; usage_amount: number; materials: MatEmbed | MatEmbed[] | null };
  type SeasonEmbed = { name: string };
  type RawVersion = {
    id: string; model_id: string; status: string; changelog: string | null;
    orderable_sizes: string[] | null; accessory_composition: string | null; updated_at: string;
    cutting_minutes: number; sewing_minutes: number; knitting_minutes: number;
    thread_minutes: number; finish_minutes: number; packing_minutes: number;
    seasons: SeasonEmbed | SeasonEmbed[] | null;
  };

  const [{ data: versions }, { data: mats }, { data: prods }, { data: settings }] = await Promise.all([
    supabase
      .from("model_versions")
      .select(
        "id, model_id, status, changelog, orderable_sizes, accessory_composition, updated_at, " +
          "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, seasons(name)"
      )
      .in("id", versionIds),
    supabase
      .from("model_version_materials")
      .select("model_version_id, role, usage_amount, materials(name, set_price_jpy)")
      .in("model_version_id", versionIds),
    supabase.from("products").select("model_version_id").in("model_version_id", versionIds),
    supabase.from("company_settings").select("labor_rate_jpy_per_hour").single(),
  ]);
  const laborRate = Number((settings as { labor_rate_jpy_per_hour: number } | null)?.labor_rate_jpy_per_hour) || 2000;

  const pCount = new Map<string, number>();
  for (const p of (prods ?? []) as { model_version_id: string }[]) pCount.set(p.model_version_id, (pCount.get(p.model_version_id) ?? 0) + 1);

  const mCount = new Map<string, number>();
  const matCost = new Map<string, number>();
  const liningName = new Map<string, string>();
  const matOf = (m: MatEmbed | MatEmbed[] | null) => (Array.isArray(m) ? m[0] : m);
  for (const r of (mats ?? []) as unknown as MatRow[]) {
    mCount.set(r.model_version_id, (mCount.get(r.model_version_id) ?? 0) + 1);
    const mm = matOf(r.materials);
    matCost.set(r.model_version_id, (matCost.get(r.model_version_id) ?? 0) + Number(mm?.set_price_jpy ?? 0) * Number(r.usage_amount ?? 0));
    if (r.role === "lining" && mm?.name) liningName.set(r.model_version_id, mm.name);
  }

  const seasonName = (s: RawVersion["seasons"]): string => (Array.isArray(s) ? s[0]?.name : s?.name) ?? "—";

  return ((versions ?? []) as unknown as RawVersion[])
    .map((v) => {
      const minutes =
        Number(v.cutting_minutes) + Number(v.sewing_minutes) + Number(v.knitting_minutes) +
        Number(v.thread_minutes) + Number(v.finish_minutes) + Number(v.packing_minutes);
      const mfgHours = minutes / 60;
      return {
        id: v.id,
        model_id: v.model_id,
        season: seasonName(v.seasons),
        status: v.status,
        changelog: v.changelog,
        sizes_count: (v.orderable_sizes ?? []).length,
        accessory_composition: v.accessory_composition,
        updated_at: v.updated_at,
        product_count: pCount.get(v.id) ?? 0,
        material_count: mCount.get(v.id) ?? 0,
        lining_label: liningName.get(v.id) ?? "None",
        total_cost: Math.round(matCost.get(v.id) ?? 0) + Math.round(mfgHours * laborRate),
        mfg_hours: mfgHours,
      };
    })
    // Chronological-ish by season name (no true cross-format sort helper exists yet).
    .sort((a, b) => a.season.localeCompare(b.season));
}
