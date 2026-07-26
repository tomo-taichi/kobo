import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTimeLogs } from "@/lib/time-logs";
import { TIME_LOG_STAGES } from "@/lib/production-constants";
import { TimeLogEntries } from "@/components/time-log-entries";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ADR-0009 Phase 3 — production work-hours aggregation (per worker) for a season.
export default async function ProductionHoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const entries = await getTimeLogs(supabase, seasonId);

  const workers = new Map<string, { total: number; byStage: Record<string, number> }>();
  for (const e of entries) {
    let w = workers.get(e.workerName);
    if (!w) {
      w = { total: 0, byStage: {} };
      workers.set(e.workerName, w);
    }
    w.total = r2(w.total + e.hours);
    w.byStage[e.stage] = r2((w.byStage[e.stage] ?? 0) + e.hours);
  }
  const summary = Array.from(workers.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ja"));
  const grandTotal = r2(entries.reduce((a, e) => a + e.hours, 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/seasons/${seasonId}/production/kanban`} className="text-sm text-gray-500 hover:text-gray-900">
          ← Kanban
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Production Hours: {season.name}</h1>

      {summary.length === 0 ? (
        <p className="text-gray-400 text-sm">No hours logged yet. Use “⏱ Log time” on a Kanban card.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Worker</th>
                {TIME_LOG_STAGES.map((s) => (
                  <th key={s.key} className="text-right px-4 py-3 font-medium text-gray-600">{s.label}</th>
                ))}
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((w) => (
                <tr key={w.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{w.name}</td>
                  {TIME_LOG_STAGES.map((s) => (
                    <td key={s.key} className="px-4 py-3 text-right font-mono text-gray-600">
                      {w.byStage[s.key] ? `${w.byStage[s.key]}h` : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{w.total}h</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td className="px-4 py-3 text-right font-medium text-gray-700" colSpan={TIME_LOG_STAGES.length + 1}>
                  Total
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold">{grandTotal}h</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <TimeLogEntries seasonId={seasonId} entries={entries} />
    </div>
  );
}
