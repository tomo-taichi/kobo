import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0009 Phase 3 — work-time log reads.

export type TimeLogEntry = {
  id: string;
  batchId: string;
  stage: string;
  workerName: string;
  hours: number;
  workDate: string | null;
  modelName: string;
  colorName: string | null;
};

// All logs in a season, newest first, with the batch's model/colour for display.
// Tolerant: returns [] if the table doesn't exist yet (before the migration).
export async function getTimeLogs(supabase: SupabaseClient, seasonId: string): Promise<TimeLogEntry[]> {
  const { data, error } = await supabase
    .from("production_time_logs")
    .select(
      "id, batch_id, stage, worker_name, hours, work_date, production_batches(products(model_name, name), product_colors(material_colors(color)))"
    )
    .eq("season_id", seasonId)
    .order("work_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    batchId: r.batch_id,
    stage: r.stage,
    workerName: r.worker_name,
    hours: Number(r.hours ?? 0),
    workDate: r.work_date ?? null,
    modelName: r.production_batches?.products?.model_name || r.production_batches?.products?.name || "—",
    colorName: r.production_batches?.product_colors?.material_colors?.color ?? null,
  }));
}

// Total logged hours per batch (for the Kanban card indicator).
export async function getBatchLoggedHours(supabase: SupabaseClient, seasonId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("production_time_logs")
    .select("batch_id, hours")
    .eq("season_id", seasonId);
  const out = new Map<string, number>();
  if (error || !data) return out;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of data as any[]) {
    out.set(r.batch_id, (out.get(r.batch_id) ?? 0) + Number(r.hours ?? 0));
  }
  return out;
}
