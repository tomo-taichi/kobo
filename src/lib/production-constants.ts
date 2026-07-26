export const PRODUCTION_STAGES = [
  { key: "pattern_done", label: "Pattern" },
  { key: "cut_done",     label: "Cut" },
  { key: "sew_done",     label: "Sew" },
  { key: "fin_done",     label: "Finish" },
  { key: "ready_done",   label: "Ready" },
] as const;

export type StageKey = typeof PRODUCTION_STAGES[number]["key"];

// ── ADR-0009 Phase 3 — batch-level Kanban stages ─────────────────────────────
// A ProductionBatch (Model × Color) flows through these columns. The current
// column is derived from its status fields (first stage that isn't complete),
// so completing a stage auto-advances the batch to the next column.
export const BATCH_COLUMNS = [
  { key: "fabric",  label: "Fabric Wait" },
  { key: "pattern", label: "Pattern" },
  { key: "cut",     label: "Cut" },
  { key: "sew",     label: "Sew" },
  { key: "finish",  label: "Finish" },
  { key: "done",    label: "Done" },
] as const;

export type BatchColumnKey = typeof BATCH_COLUMNS[number]["key"];

// Priority is stored as an integer on production_batches; higher = more urgent.
// The Kanban presents it as a 4-level select and sorts each column by it (desc).
export const PRIORITY_LEVELS = [
  { value: 3, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 1, label: "Medium" },
  { value: 0, label: "Low" },
] as const;

export const CUT_SEW_FIN_STATUSES = ["ready", "started", "finished"] as const;
export const PATTERN_STATES = [
  { key: "new",          label: "New" },
  { key: "print_needed", label: "Print" },
  { key: "done",         label: "Done" },
] as const;

export function currentBatchStage(b: {
  fabric_arrived: boolean;
  pattern_state: string;
  cut_status: string;
  sew_status: string;
  fin_status: string;
}): BatchColumnKey {
  if (!b.fabric_arrived) return "fabric";
  if (b.pattern_state !== "done") return "pattern";
  if (b.cut_status !== "finished") return "cut";
  if (b.sew_status !== "finished") return "sew";
  if (b.fin_status !== "finished") return "finish";
  return "done";
}
