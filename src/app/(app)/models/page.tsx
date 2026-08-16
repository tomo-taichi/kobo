import { createClient } from "@/lib/supabase/server";
import { getListValues } from "@/lib/list-options";
import { loadAllVersionRows, fetchAllRows, type VersionRow } from "@/lib/version-rows";
import { ModelsClient, type ModelRow } from "@/components/models-client";
import { ModelsViewToggle } from "@/components/models-view-toggle";

export default async function ModelsPage() {
  const supabase = await createClient();

  const [{ data: models }, { data: mtags }, tagOptions, allVersions, prods] = await Promise.all([
    supabase.from("models").select("id, name, category, archived").order("name"),
    supabase.from("model_tags").select("model_id, tag"),
    getListValues(supabase, "product_tag", []),
    loadAllVersionRows(supabase),
    fetchAllRows<{ model_version_id: string; product_sex: string | null }>((f, t) =>
      supabase.from("products").select("model_version_id, product_sex").not("model_version_id", "is", null).range(f, t)
    ),
  ]);

  const versionToModel = new Map<string, string>();
  const versionsByModel = new Map<string, VersionRow[]>();
  for (const vr of allVersions) {
    versionToModel.set(vr.id, vr.model_id);
    const arr = versionsByModel.get(vr.model_id) ?? [];
    arr.push(vr);
    versionsByModel.set(vr.model_id, arr);
  }

  const sexesByModel = new Map<string, Set<string>>();
  for (const p of prods) {
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
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Models</h1>
        <ModelsViewToggle current="models" />
      </div>
      <ModelsClient models={rows} tagOptions={tagOptions} />
    </div>
  );
}
