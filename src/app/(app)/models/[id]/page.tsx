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

  const [{ data: versions }, { data: tagRows }, { data: seasons }, tagOptions] = await Promise.all([
    supabase
      .from("model_versions")
      .select("id, status, changelog, orderable_sizes, accessory_composition, updated_at, seasons(name)")
      .eq("model_id", id),
    supabase.from("model_tags").select("tag").eq("model_id", id),
    supabase.from("seasons").select("id, name").order("name"),
    getListValues(supabase, "product_tag", []),
  ]);

  const vIds = ((versions ?? []) as { id: string }[]).map((v) => v.id);
  let prods: { model_version_id: string }[] = [];
  let mats: { model_version_id: string }[] = [];
  if (vIds.length) {
    const [pr, mr] = await Promise.all([
      supabase.from("products").select("model_version_id").in("model_version_id", vIds),
      supabase.from("model_version_materials").select("model_version_id").in("model_version_id", vIds),
    ]);
    prods = (pr.data ?? []) as { model_version_id: string }[];
    mats = (mr.data ?? []) as { model_version_id: string }[];
  }
  const pCount = new Map<string, number>();
  for (const p of prods) pCount.set(p.model_version_id, (pCount.get(p.model_version_id) ?? 0) + 1);
  const mCount = new Map<string, number>();
  for (const m of mats) mCount.set(m.model_version_id, (mCount.get(m.model_version_id) ?? 0) + 1);

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
    seasons: SeasonEmbed | SeasonEmbed[] | null;
  };
  const seasonName = (s: RawVersion["seasons"]): string =>
    (Array.isArray(s) ? s[0]?.name : s?.name) ?? "—";

  const versionRows: VersionRow[] = ((versions ?? []) as unknown as RawVersion[])
    .map((v) => ({
      id: v.id,
      season: seasonName(v.seasons),
      status: v.status,
      changelog: v.changelog,
      sizes_count: (v.orderable_sizes ?? []).length,
      accessory_composition: v.accessory_composition,
      updated_at: v.updated_at,
      product_count: pCount.get(v.id) ?? 0,
      material_count: mCount.get(v.id) ?? 0,
    }))
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
