import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getListValues } from "@/lib/list-options";
import { ModelDetail, type ModelDetailData, type VersionRow } from "@/components/model-detail";

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("models")
    .select("id, name, category, archived")
    .eq("id", id)
    .single();
  if (!model) notFound();

  const [{ data: versions }, { data: tagRows }, { data: seasons }, { data: settings }, tagOptions] = await Promise.all([
    supabase
      .from("model_versions")
      .select(
        "id, status, changelog, orderable_sizes, accessory_composition, updated_at, " +
          "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, seasons(name)"
      )
      .eq("model_id", id),
    supabase.from("model_tags").select("tag").eq("model_id", id),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("company_settings").select("labor_rate_jpy_per_hour").single(),
    getListValues(supabase, "product_tag", []),
  ]);
  const laborRate = Number((settings as { labor_rate_jpy_per_hour: number } | null)?.labor_rate_jpy_per_hour) || 2000;

  const vIds = ((versions ?? []) as unknown as { id: string }[]).map((v) => v.id);
  type MatEmbed = { name: string; set_price_jpy: number | null };
  type MatRow = { model_version_id: string; role: string; usage_amount: number; materials: MatEmbed | MatEmbed[] | null };
  let prods: { model_version_id: string }[] = [];
  let mats: MatRow[] = [];
  if (vIds.length) {
    const [pr, mr] = await Promise.all([
      supabase.from("products").select("model_version_id").in("model_version_id", vIds),
      supabase
        .from("model_version_materials")
        .select("model_version_id, role, usage_amount, materials(name, set_price_jpy)")
        .in("model_version_id", vIds),
    ]);
    prods = (pr.data ?? []) as { model_version_id: string }[];
    mats = (mr.data ?? []) as unknown as MatRow[];
  }
  const pCount = new Map<string, number>();
  for (const p of prods) pCount.set(p.model_version_id, (pCount.get(p.model_version_id) ?? 0) + 1);
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

  // PostgREST types a to-one embed (seasons) as an array; at runtime it's a single
  // object. Normalize both shapes. `as unknown as` avoids `any` (keeps lint clean).
  type SeasonEmbed = { name: string };
  type RawVersion = {
    id: string;
    status: string;
    changelog: string | null;
    orderable_sizes: string[] | null;
    accessory_composition: string | null;
    updated_at: string;
    cutting_minutes: number; sewing_minutes: number; knitting_minutes: number;
    thread_minutes: number; finish_minutes: number; packing_minutes: number;
    seasons: SeasonEmbed | SeasonEmbed[] | null;
  };
  const seasonName = (s: RawVersion["seasons"]): string =>
    (Array.isArray(s) ? s[0]?.name : s?.name) ?? "—";

  const versionRows: VersionRow[] = ((versions ?? []) as unknown as RawVersion[])
    .map((v) => {
      const minutes = Number(v.cutting_minutes) + Number(v.sewing_minutes) + Number(v.knitting_minutes) + Number(v.thread_minutes) + Number(v.finish_minutes) + Number(v.packing_minutes);
      const mfgHours = minutes / 60;
      const totalCost = Math.round(matCost.get(v.id) ?? 0) + Math.round(mfgHours * laborRate);
      return {
        id: v.id,
        season: seasonName(v.seasons),
        status: v.status,
        changelog: v.changelog,
        sizes_count: (v.orderable_sizes ?? []).length,
        accessory_composition: v.accessory_composition,
        updated_at: v.updated_at,
        product_count: pCount.get(v.id) ?? 0,
        material_count: mCount.get(v.id) ?? 0,
        lining_label: liningName.get(v.id) ?? "None",
        total_cost: totalCost,
        mfg_hours: mfgHours,
      };
    })
    // Chronological-ish by season name (no true cross-format sort helper exists yet).
    .sort((a, b) => a.season.localeCompare(b.season));

  const data: ModelDetailData = {
    id: model.id,
    name: model.name,
    category: model.category,
    archived: model.archived,
    tags: ((tagRows ?? []) as { tag: string }[]).map((t) => t.tag),
    versions: versionRows,
  };

  return (
    <ModelDetail
      data={data}
      tagOptions={tagOptions}
      seasons={((seasons ?? []) as { id: string; name: string }[])}
    />
  );
}
