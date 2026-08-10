import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModelVersionEditor, type VersionEditData } from "@/components/model-version-editor";
import type { PickableMaterial } from "@/components/material-picker";

const MATERIAL_SELECT =
  "id, name, color, category, material_number, set_price_jpy, unit_type, " +
  "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
  "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, " +
  "colors:material_colors(id, color), seasons(name)";

export default async function ModelVersionEditPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id, versionId } = await params;
  const supabase = await createClient();

  const { data: version } = await supabase
    .from("model_versions")
    .select(
      "id, model_id, status, changelog, orderable_sizes, accessory_composition, " +
        "cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes, " +
        "seasons(name)"
    )
    .eq("id", versionId)
    .single();
  if (!version) notFound();

  const v = version as unknown as {
    id: string;
    model_id: string;
    status: string;
    changelog: string | null;
    orderable_sizes: string[] | null;
    accessory_composition: string | null;
    cutting_minutes: number;
    sewing_minutes: number;
    knitting_minutes: number;
    thread_minutes: number;
    finish_minutes: number;
    packing_minutes: number;
    seasons: { name: string } | { name: string }[] | null;
  };
  // Guard against a version id that doesn't belong to the model in the URL.
  if (v.model_id !== id) notFound();

  const [{ data: model }, { data: matRows }, { data: materials }, { data: settings }] = await Promise.all([
    supabase.from("models").select("id, name, category").eq("id", id).single(),
    supabase
      .from("model_version_materials")
      .select("role, material_id, material_color_id, usage_amount, sort_order")
      .eq("model_version_id", versionId)
      .order("sort_order"),
    supabase.from("materials").select(MATERIAL_SELECT).order("name"),
    supabase.from("company_settings").select("labor_rate_jpy_per_hour").single(),
  ]);
  if (!model) notFound();

  const seasonName = Array.isArray(v.seasons) ? v.seasons[0]?.name : v.seasons?.name;

  const data: VersionEditData = {
    modelId: id,
    modelName: model.name,
    category: model.category,
    versionId: v.id,
    season: seasonName ?? "—",
    status: v.status,
    changelog: v.changelog ?? "",
    orderableSizes: v.orderable_sizes ?? [],
    accessoryComposition: v.accessory_composition ?? "",
    minutes: {
      cutting: Number(v.cutting_minutes),
      sewing: Number(v.sewing_minutes),
      knitting: Number(v.knitting_minutes),
      thread: Number(v.thread_minutes),
      finish: Number(v.finish_minutes),
      packing: Number(v.packing_minutes),
    },
    materials: ((matRows ?? []) as {
      role: string;
      material_id: string;
      material_color_id: string | null;
      usage_amount: number;
    }[]).map((m) => ({
      role: m.role,
      material_id: m.material_id,
      material_color_id: m.material_color_id,
      usage_amount: Number(m.usage_amount),
    })),
  };

  return (
    <ModelVersionEditor
      data={data}
      materials={(materials ?? []) as unknown as PickableMaterial[]}
      laborRate={Number((settings as { labor_rate_jpy_per_hour: number } | null)?.labor_rate_jpy_per_hour) || 2000}
    />
  );
}
