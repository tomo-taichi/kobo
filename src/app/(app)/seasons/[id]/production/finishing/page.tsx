import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentBatchStage, FINISHING_STEPS } from "@/lib/production-constants";
import { FinishingChecklist, type FinishingState } from "@/components/finishing-checklist";
import { ProductionTabNav } from "@/components/production-tab-nav";
import { buildColorSkuMap } from "@/lib/skus";
import { fmtProductId } from "@/lib/format";

// ADR-0009 Phase 5 (§3.4) — Finishing page. Batches in the Finish stage only,
// grouped by model, each with the 6-step checklist + a comment.
export default async function ProductionFinishingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const [{ data }, seasonsListResult] = await Promise.all([
    supabase
      .from("production_batches")
      .select(
        "id, product_id, product_color_id, ordered_qty, priority, fabric_arrived, pattern_state, cut_status, sew_status, fin_status, fin_tape, fin_button, fin_buttonhole, fin_handsew, fin_wash, fin_tag, fin_comment, products(model_name, name, product_number), product_colors(material_colors(color))"
      )
      .eq("season_id", seasonId),
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skuMap = await buildColorSkuMap(supabase, Array.from(new Set(((data ?? []) as any[]).map((b) => b.product_id).filter(Boolean))));

  type Row = {
    id: string;
    modelName: string;
    productNumber: string | null;
    colorName: string | null;
    orderedQty: number;
    priority: number;
    steps: FinishingState;
    comment: string;
  };

  const rows: Row[] = // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((data ?? []) as any[])
      .filter((b) =>
        currentBatchStage({
          fabric_arrived: b.fabric_arrived ?? false,
          pattern_state: b.pattern_state ?? "new",
          cut_status: b.cut_status ?? "ready",
          sew_status: b.sew_status ?? "ready",
          fin_status: b.fin_status ?? "ready",
        }) === "finish"
      )
      .map((b) => ({
        id: b.id,
        modelName: b.products?.model_name || b.products?.name || "—",
        productNumber: b.product_color_id ? skuMap.get(b.product_color_id) ?? fmtProductId(b.products?.product_number) : fmtProductId(b.products?.product_number),
        colorName: b.product_colors?.material_colors?.color ?? null,
        orderedQty: b.ordered_qty ?? 0,
        priority: b.priority ?? 0,
        steps: {
          fin_tape: b.fin_tape ?? false,
          fin_button: b.fin_button ?? false,
          fin_buttonhole: b.fin_buttonhole ?? false,
          fin_handsew: b.fin_handsew ?? false,
          fin_wash: b.fin_wash ?? false,
          fin_tag: b.fin_tag ?? false,
        },
        comment: b.fin_comment ?? "",
      }));

  // Group by model.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.modelName) ?? [];
    arr.push(r);
    groups.set(r.modelName, arr);
  }
  const groupList = Array.from(groups.entries())
    .map(([model, rs]) => ({
      model,
      rows: rs.sort((a, b) => b.priority - a.priority || (a.colorName ?? "").localeCompare(b.colorName ?? "", "ja")),
    }))
    .sort((a, b) => a.model.localeCompare(b.model, "ja"));

  return (
    <div className="space-y-6">
      <ProductionTabNav seasonId={seasonId} seasons={(seasonsListResult.data ?? []) as { id: string; name: string }[]} active="finishing" />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Finishing: {season.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Batches in the Finish stage, grouped by model. Steps ({FINISHING_STEPS.map((s) => s.label).join(" · ")}):
          coloured = to do, tap to mark done (turns grey).
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-medium text-gray-800 mb-3">Tag Printing</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/seasons/${seasonId}/tags`}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Product Tags Batch PDF
          </a>
          <a
            href={`/api/seasons/${seasonId}/tags?type=composition`}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Composition Tags Batch PDF
          </a>
        </div>
      </div>

      {groupList.length === 0 ? (
        <p className="text-gray-400 text-sm">No batches in the finishing stage.</p>
      ) : (
        groupList.map((g) => (
          <div key={g.model} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">
                {g.model} <span className="text-gray-400 font-normal">· {g.rows.length}</span>
              </span>
              <div className="flex gap-2 shrink-0">
                <a
                  href={`/api/seasons/${seasonId}/tags?model=${encodeURIComponent(g.model)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Product Tags
                </a>
                <a
                  href={`/api/seasons/${seasonId}/tags?type=composition&model=${encodeURIComponent(g.model)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Composition Tags
                </a>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {g.rows.map((r) => (
                <div key={r.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 shrink-0">
                    <div className="text-sm font-medium text-gray-900">
                      {r.colorName ?? "—"}
                      <span className="ml-2 text-xs text-gray-400 font-mono">×{r.orderedQty}</span>
                    </div>
                    {r.productNumber ? <div className="text-xs text-gray-400 font-mono">{r.productNumber}</div> : null}
                  </div>
                  <div className="flex-1 sm:max-w-md">
                    <FinishingChecklist batchId={r.id} seasonId={seasonId} steps={r.steps} comment={r.comment} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
