import { createClient } from "@/lib/supabase/server";
import { getListValues } from "@/lib/list-options";
import { loadVersionRows, type VersionRow } from "@/lib/version-rows";
import { ModelsClient, type ModelRow } from "@/components/models-client";

export default async function ModelsPage() {
  const supabase = await createClient();

  const [{ data: models }, { data: vidRows }, { data: prods }, { data: mtags }, tagOptions] = await Promise.all([
    supabase.from("models").select("id, name, category, archived").order("name"),
    supabase.from("model_versions").select("id, model_id"),
    supabase.from("products").select("model_version_id, product_sex").not("model_version_id", "is", null),
    supabase.from("model_tags").select("model_id, tag"),
    getListValues(supabase, "product_tag", []),
  ]);

  const versionToModel = new Map<string, string>();
  for (const v of (vidRows ?? []) as { id: string; model_id: string }[]) versionToModel.set(v.id, v.model_id);

  // Rich per-version rows (season/status/lining/counts/total/mfg), grouped by model.
  const versionRows = await loadVersionRows(supabase, ((vidRows ?? []) as { id: string }[]).map((v) => v.id));
  const versionsByModel = new Map<string, VersionRow[]>();
  for (const vr of versionRows) {
    const arr = versionsByModel.get(vr.model_id) ?? [];
    arr.push(vr);
    versionsByModel.set(vr.model_id, arr);
  }

  const sexesByModel = new Map<string, Set<string>>();
  for (const p of (prods ?? []) as { model_version_id: string; product_sex: string | null }[]) {
    const modelId = versionToModel.get(p.model_version_id);
    if (!modelId || !p.product_sex) continue;
    const s = sexesByModel.get(modelId) ?? new Set<string>();
    s.add(p.product_sex);
    sexesByModel.set(modelId, s);
  }

  const tagsByModel = new Map<string, string[]>();
  for (const t of (mtags ?? []) as { model_id: string; tag: string }[]) {
    const arr = tagsByModel.get(t.model_id) ?? [];
    arr.push(t.tag);
    tagsByModel.set(t.model_id, arr);
  }

  const rows: ModelRow[] = ((models ?? []) as { id: string; name: string; category: string; archived: boolean }[]).map((m) => {
    const vs = versionsByModel.get(m.id) ?? [];
    return {
      id: m.id,
      name: m.name,
      category: m.category,
      archived: m.archived,
      sexes: Array.from(sexesByModel.get(m.id) ?? []).sort(),
      version_count: vs.length,
      product_count: vs.reduce((sum, v) => sum + v.product_count, 0),
      tags: (tagsByModel.get(m.id) ?? []).sort(),
      versions: vs,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Models</h1>
      </div>
      <ModelsClient models={rows} tagOptions={tagOptions} />
    </div>
  );
}
