import { createClient } from "@/lib/supabase/server";
import { getListValues } from "@/lib/list-options";
import { ModelsClient, type ModelRow, type ModelVersionLite } from "@/components/models-client";

export default async function ModelsPage() {
  const supabase = await createClient();

  // Small sets (~714 models / ~936 versions / ~1.9k linked products / tags), folded in memory.
  const [{ data: models }, { data: versions }, { data: prods }, { data: mtags }, tagOptions] = await Promise.all([
    supabase.from("models").select("id, name, category, archived").order("name"),
    supabase.from("model_versions").select("id, model_id, status, seasons(name)"),
    supabase.from("products").select("model_version_id, product_sex").not("model_version_id", "is", null),
    supabase.from("model_tags").select("model_id, tag"),
    getListValues(supabase, "product_tag", []),
  ]);

  type VRow = { id: string; model_id: string; status: string; seasons: { name: string } | { name: string }[] | null };
  type PRow = { model_version_id: string; product_sex: string | null };
  type TRow = { model_id: string; tag: string };
  type MRow = { id: string; name: string; category: string; archived: boolean };
  const seasonName = (s: VRow["seasons"]): string => (Array.isArray(s) ? s[0]?.name : s?.name) ?? "—";

  const versionToModel = new Map<string, string>();
  const versionsByModel = new Map<string, ModelVersionLite[]>();
  for (const v of (versions ?? []) as unknown as VRow[]) {
    versionToModel.set(v.id, v.model_id);
    const arr = versionsByModel.get(v.model_id) ?? [];
    arr.push({ id: v.id, season: seasonName(v.seasons), status: v.status });
    versionsByModel.set(v.model_id, arr);
  }
  for (const arr of versionsByModel.values()) arr.sort((a, b) => a.season.localeCompare(b.season));

  const productCount = new Map<string, number>();
  const sexesByModel = new Map<string, Set<string>>();
  for (const p of (prods ?? []) as unknown as PRow[]) {
    const modelId = versionToModel.get(p.model_version_id);
    if (!modelId) continue;
    productCount.set(modelId, (productCount.get(modelId) ?? 0) + 1);
    if (p.product_sex) {
      const s = sexesByModel.get(modelId) ?? new Set<string>();
      s.add(p.product_sex);
      sexesByModel.set(modelId, s);
    }
  }

  const tagsByModel = new Map<string, string[]>();
  for (const t of (mtags ?? []) as unknown as TRow[]) {
    const arr = tagsByModel.get(t.model_id) ?? [];
    arr.push(t.tag);
    tagsByModel.set(t.model_id, arr);
  }

  const rows: ModelRow[] = ((models ?? []) as unknown as MRow[]).map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    archived: m.archived,
    sexes: Array.from(sexesByModel.get(m.id) ?? []).sort(),
    version_count: (versionsByModel.get(m.id) ?? []).length,
    product_count: productCount.get(m.id) ?? 0,
    tags: (tagsByModel.get(m.id) ?? []).sort(),
    versions: versionsByModel.get(m.id) ?? [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Models</h1>
      </div>
      <ModelsClient models={rows} tagOptions={tagOptions} />
    </div>
  );
}
