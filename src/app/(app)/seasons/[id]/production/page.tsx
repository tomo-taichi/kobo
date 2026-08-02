import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentBatchStage, type BatchColumnKey } from "@/lib/production-constants";
import { buildBatchOrderDetails } from "@/lib/production-view";
import { StageProgressBar } from "@/components/stage-progress-bar";
import { ProductionTabNav } from "@/components/production-tab-nav";

// ADR-0009 — Production Progress: batch progress grouped by client (progress bars).
// (Replaces the legacy per-product production_progress grid, now superseded by the
// batch Kanban.)
export default async function ProductionProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const [batchesResult, detailsByColor, seasonsListResult] = await Promise.all([
    supabase
      .from("production_batches")
      .select("id, product_color_id, ordered_qty, priority, fabric_arrived, pattern_state, cut_status, sew_status, fin_status, products(model_name, name, product_number), product_colors(material_colors(color))")
      .eq("season_id", seasonId),
    buildBatchOrderDetails(supabase, seasonId),
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false }),
  ]);
  const seasonsList = (seasonsListResult.data ?? []) as { id: string; name: string }[];

  type BatchRow = {
    id: string;
    modelName: string;
    colorName: string | null;
    orderedQty: number;
    priority: number;
    stage: BatchColumnKey;
    productColorId: string | null;
  };
  const batchRows: BatchRow[] = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((batchesResult.data ?? []) as any[]).map((b) => ({
      id: b.id,
      modelName: b.products?.model_name || b.products?.name || "—",
      colorName: b.product_colors?.material_colors?.color ?? null,
      orderedQty: b.ordered_qty ?? 0,
      priority: b.priority ?? 0,
      stage: currentBatchStage({
        fabric_arrived: b.fabric_arrived ?? false,
        pattern_state: b.pattern_state ?? "new",
        cut_status: b.cut_status ?? "ready",
        sew_status: b.sew_status ?? "ready",
        fin_status: b.fin_status ?? "ready",
      }),
      productColorId: b.product_color_id ?? null,
    }));

  const stageRank: Record<BatchColumnKey, number> = { fabric: 0, pattern: 1, cut: 2, sew: 3, finish: 4, done: 5 };
  const clientGroups = new Map<string, BatchRow[]>();
  for (const r of batchRows) {
    const clients = r.productColorId ? detailsByColor.get(r.productColorId) ?? [] : [];
    const names = clients.length ? Array.from(new Set(clients.map((c) => c.customerName ?? "—"))) : ["—"];
    for (const name of names) {
      const arr = clientGroups.get(name) ?? [];
      arr.push(r);
      clientGroups.set(name, arr);
    }
  }
  const clientGroupList = Array.from(clientGroups.entries())
    .map(([client, rs]) => ({
      client,
      rows: rs.sort(
        (a, b) => b.priority - a.priority || stageRank[a.stage] - stageRank[b.stage] || a.modelName.localeCompare(b.modelName, "ja")
      ),
    }))
    .sort((a, b) => a.client.localeCompare(b.client, "ja"));

  return (
    <div className="space-y-6">
      <ProductionTabNav seasonId={seasonId} seasons={seasonsList} active="progress" />
      <h1 className="text-2xl font-semibold text-gray-900">Production Progress: {season.name}</h1>

      {clientGroupList.length === 0 ? (
        <p className="text-gray-400 text-sm">No batches yet. Generate them from the Kanban.</p>
      ) : (
        <div className="space-y-4">
          <h2 className="text-base font-medium text-gray-800">Progress by Client</h2>
          {clientGroupList.map((g) => (
            <div key={g.client} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-800">
                {g.client} <span className="text-gray-400 font-normal">· {g.rows.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {g.rows.map((r) => (
                  <div key={`${g.client}-${r.id}`} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{r.modelName}</span>
                      <span className="ml-2 text-xs text-gray-500">{r.colorName ?? "—"}</span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">×{r.orderedQty}</span>
                    </div>
                    <StageProgressBar stage={r.stage} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
