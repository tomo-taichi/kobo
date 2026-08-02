import { BATCH_COLUMNS, type BatchColumnKey } from "@/lib/production-constants";

// ADR-0009 Phase 5 — visual progress of a batch through the production stages
// (Fabric → Pattern → Cut → Sew → Finish → Done). Completed stages are filled,
// the current one is highlighted, later ones are pending.
export function StageProgressBar({ stage }: { stage: BatchColumnKey }) {
  const idx = BATCH_COLUMNS.findIndex((c) => c.key === stage);
  const done = stage === "done";
  const steps = BATCH_COLUMNS.length - 1; // stages to complete (excl. the terminal "Done")

  return (
    <div className="w-full sm:w-64">
      <div className="flex gap-0.5">
        {BATCH_COLUMNS.map((c, i) => {
          const cls = i < idx || done ? "bg-green-500" : i === idx ? "bg-amber-400" : "bg-gray-200";
          return <div key={c.key} title={c.label} className={`h-2 flex-1 rounded-sm ${cls}`} />;
        })}
      </div>
      <div className="mt-1 text-[11px] text-gray-500">
        {done ? "Done" : `${BATCH_COLUMNS[idx]?.label} · ${idx}/${steps}`}
      </div>
    </div>
  );
}
