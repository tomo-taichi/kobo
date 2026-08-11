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
  locked: boolean; // in production (a finalised product uses it) → read-only / "Locked"
};

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

const VERSION_SELECT =
  "id, model_id, status, changelog, orderable_sizes, accessory_composition, updated_at, " +
  "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, seasons(name)";
const MV_MAT_SELECT = "model_version_id, role, usage_amount, materials(name, set_price_jpy)";

// Page through a Supabase select in 1000-row chunks (Supabase caps a request at 1000).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T>(page: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await page(from, from + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function computeVersionRows(
  versions: RawVersion[],
  mats: MatRow[],
  prods: { model_version_id: string; status: string | null }[],
  laborRate: number
): VersionRow[] {
  const pCount = new Map<string, number>();
  const lockedSet = new Set<string>(); // has a finalised (production-started) product
  for (const p of prods) {
    pCount.set(p.model_version_id, (pCount.get(p.model_version_id) ?? 0) + 1);
    if (p.status === "final") lockedSet.add(p.model_version_id);
  }

  const mCount = new Map<string, number>();
  const matCost = new Map<string, number>();
  const liningName = new Map<string, string>();
  const matOf = (m: MatEmbed | MatEmbed[] | null) => (Array.isArray(m) ? m[0] : m);
  for (const r of mats) {
    mCount.set(r.model_version_id, (mCount.get(r.model_version_id) ?? 0) + 1);
    const mm = matOf(r.materials);
    matCost.set(r.model_version_id, (matCost.get(r.model_version_id) ?? 0) + Number(mm?.set_price_jpy ?? 0) * Number(r.usage_amount ?? 0));
    if (r.role === "lining" && mm?.name) liningName.set(r.model_version_id, mm.name);
  }

  const seasonName = (s: RawVersion["seasons"]): string => (Array.isArray(s) ? s[0]?.name : s?.name) ?? "—";

  return versions
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
        locked: lockedSet.has(v.id),
      };
    })
    .sort((a, b) => a.season.localeCompare(b.season));
}

async function laborRateOf(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("company_settings").select("labor_rate_jpy_per_hour").single();
  return Number((data as { labor_rate_jpy_per_hour: number } | null)?.labor_rate_jpy_per_hour) || 2000;
}

// A specific set of versions (few — e.g. one model's). Uses .in(), so keep the list small.
export async function loadVersionRows(supabase: SupabaseClient, versionIds: string[]): Promise<VersionRow[]> {
  if (!versionIds.length) return [];
  const [{ data: versions }, { data: mats }, { data: prods }, laborRate] = await Promise.all([
    supabase.from("model_versions").select(VERSION_SELECT).in("id", versionIds),
    supabase.from("model_version_materials").select(MV_MAT_SELECT).in("model_version_id", versionIds),
    supabase.from("products").select("model_version_id, status").in("model_version_id", versionIds),
    laborRateOf(supabase),
  ]);
  return computeVersionRows(
    (versions ?? []) as unknown as RawVersion[],
    (mats ?? []) as unknown as MatRow[],
    (prods ?? []) as { model_version_id: string; status: string | null }[],
    laborRate
  );
}

// EVERY version (for the Models list). Paged fetch — never a huge .in() (that blows the URL).
export async function loadAllVersionRows(supabase: SupabaseClient): Promise<VersionRow[]> {
  const [versions, mats, prods, laborRate] = await Promise.all([
    fetchAllRows<RawVersion>((f, t) => supabase.from("model_versions").select(VERSION_SELECT).range(f, t)),
    fetchAllRows<MatRow>((f, t) => supabase.from("model_version_materials").select(MV_MAT_SELECT).range(f, t)),
    fetchAllRows<{ model_version_id: string; status: string | null }>((f, t) => supabase.from("products").select("model_version_id, status").not("model_version_id", "is", null).range(f, t)),
    laborRateOf(supabase),
  ]);
  return computeVersionRows(versions, mats, prods, laborRate);
}
