import { createClient } from "@/lib/supabase/server";
import { loadAllVersionRows, type VersionRow } from "@/lib/version-rows";
import { VersionsClient, type VersionGroup } from "@/components/versions-client";

export default async function ModelVersionsPage() {
  const supabase = await createClient();

  const [{ data: models }, allVersions] = await Promise.all([
    supabase.from("models").select("id, name, category"),
    loadAllVersionRows(supabase),
  ]);

  const modelMap = new Map(
    ((models ?? []) as { id: string; name: string; category: string }[]).map((m) => [m.id, m])
  );

  // Group all versions by their model (name + category = model identity).
  const groupsMap = new Map<string, VersionRow[]>();
  for (const v of allVersions) {
    const arr = groupsMap.get(v.model_id) ?? [];
    arr.push(v);
    groupsMap.set(v.model_id, arr);
  }
  const groups: VersionGroup[] = [...groupsMap.entries()]
    .map(([modelId, versions]) => {
      const m = modelMap.get(modelId);
      return { modelId, modelName: m?.name ?? "—", modelCategory: m?.category ?? "—", versions };
    })
    .sort((a, b) => a.modelName.toLowerCase().localeCompare(b.modelName.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Model Versions</h1>
      <VersionsClient groups={groups} />
    </div>
  );
}
