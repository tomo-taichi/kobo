import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BatchKanban, type BatchCard } from "@/components/batch-kanban";
import { GenerateBatchesButton } from "@/components/generate-batches-button";
import { getListOptions } from "@/lib/list-options";
import { buildBatchOrderDetails } from "@/lib/production-view";
import { getTimeLogs, type TimeLogEntry } from "@/lib/time-logs";
import { estimatedStageMinutes } from "@/lib/pricing";
import { ProductionTabNav } from "@/components/production-tab-nav";
import { buildColorSkuMap } from "@/lib/skus";
import { fmtProductId } from "@/lib/format";

const round1 = (n: number) => Math.round(n * 10) / 10;

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

  const [{ data }, cutters, sewers, detailsByColor, timeLogs, seasonsListResult] = await Promise.all([
    supabase
      .from("production_batches")
      .select(
        "id, product_id, product_color_id, ordered_qty, priority, fabric_arrived, pattern_state, cut_status, sew_status, fin_status, cutter_name, sewer_name, products(model_name, name, product_number, main_m_name, cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes), product_colors(material_colors(color))"
      )
      .eq("season_id", seasonId),
    getListOptions(supabase, "cutter"),
    getListOptions(supabase, "sewer"),
    buildBatchOrderDetails(supabase, seasonId),
    getTimeLogs(supabase, seasonId),
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false }),
  ]);
  const cutterOptions = cutters.filter((o) => o.active).map((o) => o.value);
  const sewerOptions = sewers.filter((o) => o.active).map((o) => o.value);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skuMap = await buildColorSkuMap(supabase, Array.from(new Set(((data ?? []) as any[]).map((b) => b.product_id).filter(Boolean))));

  // Logs grouped per batch (for card total + per-stage history in the log modal).
  const logsByBatch = new Map<string, TimeLogEntry[]>();
  for (const l of timeLogs) {
    const arr = logsByBatch.get(l.batchId) ?? [];
    arr.push(l);
    logsByBatch.set(l.batchId, arr);
  }

  const batches: BatchCard[] = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[]).map((b) => {
      const p = b.products ?? {};
      const qty = b.ordered_qty ?? 0;
      // Per-unit budget (minutes) → whole-batch hours per stage.
      const perUnit = estimatedStageMinutes({
        cutting: Number(p.cutting_minutes ?? 0),
        sewing: Number(p.sewing_minutes ?? 0),
        knitting: Number(p.knitting_minutes ?? 0),
        thread: Number(p.thread_minutes ?? 0),
        finish: Number(p.finish_minutes ?? 0),
        packing: Number(p.packing_minutes ?? 0),
      });
      const logs = logsByBatch.get(b.id) ?? [];
      return {
        id: b.id,
        modelName: p.model_name || p.name || "—",
        productNumber: b.product_color_id ? skuMap.get(b.product_color_id) ?? fmtProductId(p.product_number) : fmtProductId(p.product_number),
        colorName: b.product_colors?.material_colors?.color ?? null,
        mainMaterialName: p.main_m_name ?? null,
        orderedQty: qty,
        priority: b.priority ?? 0,
        fabric_arrived: b.fabric_arrived ?? false,
        pattern_state: b.pattern_state ?? "new",
        cut_status: b.cut_status ?? "ready",
        sew_status: b.sew_status ?? "ready",
        fin_status: b.fin_status ?? "ready",
        cutter_name: b.cutter_name ?? null,
        sewer_name: b.sewer_name ?? null,
        orderDetails: b.product_color_id ? detailsByColor.get(b.product_color_id) ?? [] : [],
        estHours: {
          cut: round1((perUnit.cut * qty) / 60),
          sew: round1((perUnit.sew * qty) / 60),
          finish: round1((perUnit.finish * qty) / 60),
        },
        logs,
      };
    });

  return (
    <div className="space-y-6">
      <ProductionTabNav seasonId={seasonId} seasons={(seasonsListResult.data ?? []) as { id: string; name: string }[]} active="kanban" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Production Kanban: {season.name}</h1>
        <GenerateBatchesButton seasonId={seasonId} />
      </div>

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
