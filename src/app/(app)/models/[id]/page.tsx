import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getListValues } from "@/lib/list-options";
import { loadVersionRows } from "@/lib/version-rows";
import { ModelDetail, type ModelDetailData } from "@/components/model-detail";

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("models")
    .select("id, name, category, archived")
    .eq("id", id)
    .single();
  if (!model) notFound();

  const [{ data: vidRows }, { data: tagRows }, { data: seasons }, tagOptions] = await Promise.all([
    supabase.from("model_versions").select("id").eq("model_id", id),
    supabase.from("model_tags").select("tag").eq("model_id", id),
    supabase.from("seasons").select("id, name").order("name"),
    getListValues(supabase, "product_tag", []),
  ]);
  const versions = await loadVersionRows(supabase, ((vidRows ?? []) as { id: string }[]).map((v) => v.id));

  const data: ModelDetailData = {
    id: model.id,
    name: model.name,
    category: model.category,
    archived: model.archived,
    tags: ((tagRows ?? []) as { tag: string }[]).map((t) => t.tag),
    versions,
  };

  return (
    <ModelDetail
      data={data}
      tagOptions={tagOptions}
      seasons={((seasons ?? []) as { id: string; name: string }[])}
    />
  );
}
