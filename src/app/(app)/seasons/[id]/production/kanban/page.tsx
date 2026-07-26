import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BatchKanban, type BatchCard } from "@/components/batch-kanban";
import { GenerateBatchesButton } from "@/components/generate-batches-button";
import { getListOptions } from "@/lib/list-options";
import { buildBatchOrderDetails } from "@/lib/production-view";

// ADR-0009 Phase 3 (§3.3) — batch-level production Kanban.
// One card per ProductionBatch (Model × Color); columns are the current stage
// derived from the batch's status fields. Completing a stage auto-advances it.
export default async function ProductionKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const [{ data }, cutters, sewers, detailsByColor] = await Promise.all([
    supabase
      .from("production_batches")
      .select(
        "id, product_color_id, ordered_qty, priority, fabric_arrived, pattern_state, cut_status, sew_status, fin_status, cutter_name, sewer_name, products(model_name, name, product_number, main_m_name), product_colors(material_colors(color))"
      )
      .eq("season_id", seasonId),
    getListOptions(supabase, "cutter"),
    getListOptions(supabase, "sewer"),
    buildBatchOrderDetails(supabase, seasonId),
  ]);
  const cutterOptions = cutters.filter((o) => o.active).map((o) => o.value);
  const sewerOptions = sewers.filter((o) => o.active).map((o) => o.value);

  const batches: BatchCard[] = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[]).map((b) => ({
      id: b.id,
      modelName: b.products?.model_name || b.products?.name || "—",
      productNumber: b.products?.product_number != null ? String(b.products.product_number) : null,
      colorName: b.product_colors?.material_colors?.color ?? null,
      mainMaterialName: b.products?.main_m_name ?? null,
      orderedQty: b.ordered_qty ?? 0,
      priority: b.priority ?? 0,
      fabric_arrived: b.fabric_arrived ?? false,
      pattern_state: b.pattern_state ?? "new",
      cut_status: b.cut_status ?? "ready",
      sew_status: b.sew_status ?? "ready",
      fin_status: b.fin_status ?? "ready",
      cutter_name: b.cutter_name ?? null,
      sewer_name: b.sewer_name ?? null,
      orderDetails: b.product_color_id ? detailsByColor.get(b.product_color_id) ?? [] : [],
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/seasons/${seasonId}/production`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Production
        </Link>
        <GenerateBatchesButton seasonId={seasonId} />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Production Kanban: {season.name}</h1>

      {batches.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No batches yet. Click “Generate / Refresh Batches” to create them from this season’s orders.
        </p>
      ) : (
        <BatchKanban seasonId={seasonId} batches={batches} cutterOptions={cutterOptions} sewerOptions={sewerOptions} />
      )}
    </div>
  );
}
