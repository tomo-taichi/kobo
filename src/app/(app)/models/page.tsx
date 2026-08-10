import { createClient } from "@/lib/supabase/server";
import { ModelsClient, type ModelRow } from "@/components/models-client";

export default async function ModelsPage() {
  const supabase = await createClient();

  // Models + per-model counts. Products link to a Model via model_version_id →
  // model_versions.model_id (two hops), so we fold the counts in memory (small sets:
  // ~714 models / ~936 versions / ~1.9k linked products).
  const [{ data: models }, { data: versions }, { data: prods }] = await Promise.all([
    supabase.from("models").select("id, name, category, archived").order("name"),
    supabase.from("model_versions").select("id, model_id"),
    supabase.from("products").select("model_version_id").not("model_version_id", "is", null),
  ]);

  const versionCount = new Map<string, number>();
  const versionToModel = new Map<string, string>();
  for (const v of (versions ?? []) as { id: string; model_id: string }[]) {
    versionCount.set(v.model_id, (versionCount.get(v.model_id) ?? 0) + 1);
    versionToModel.set(v.id, v.model_id);
  }
  const productCount = new Map<string, number>();
  for (const p of (prods ?? []) as { model_version_id: string }[]) {
    const modelId = versionToModel.get(p.model_version_id);
    if (modelId) productCount.set(modelId, (productCount.get(modelId) ?? 0) + 1);
  }

  const rows: ModelRow[] = ((models ?? []) as Omit<ModelRow, "version_count" | "product_count">[]).map((m) => ({
    ...m,
    version_count: versionCount.get(m.id) ?? 0,
    product_count: productCount.get(m.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Models</h1>
      </div>
      <ModelsClient models={rows} />
    </div>
  );
}
