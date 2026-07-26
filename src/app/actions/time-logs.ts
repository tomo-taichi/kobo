"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ADR-0009 Phase 3 — add / delete work-time log entries.

export async function addTimeLog(input: {
  batchId: string;
  seasonId: string;
  stage: string;
  workerName: string;
  hours: number;
  workDate: string | null;
}): Promise<string | null> {
  const worker = input.workerName.trim();
  if (!worker) return "Worker is required";
  if (!(input.hours > 0)) return "Hours must be greater than 0";

  const supabase = await createClient();
  const { error } = await supabase.from("production_time_logs").insert({
    batch_id: input.batchId,
    season_id: input.seasonId,
    stage: input.stage,
    worker_name: worker,
    hours: input.hours,
    work_date: input.workDate || null,
  });
  if (error) return error.message;
  revalidatePath(`/seasons/${input.seasonId}/production/kanban`);
  revalidatePath(`/seasons/${input.seasonId}/production/hours`);
  return null;
}

export async function deleteTimeLog(id: string, seasonId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_time_logs").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath(`/seasons/${seasonId}/production/kanban`);
  revalidatePath(`/seasons/${seasonId}/production/hours`);
  return null;
}
