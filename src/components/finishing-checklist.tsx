"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBatchField } from "@/app/actions/production-batches";
import { FINISHING_STEPS, type FinishingStepKey } from "@/lib/production-constants";

export type FinishingState = Record<FinishingStepKey, boolean>;

// ADR-0009 Phase 5 — the 6-step finishing checklist. Each step is a button:
// not-done = prominent colour, tap to complete → turns grey (tap again to undo).
// Plus a free-text comment (≤200 chars) saved on blur.
export function FinishingChecklist({
  batchId,
  seasonId,
  steps,
  comment,
}: {
  batchId: string;
  seasonId: string;
  steps: FinishingState;
  comment: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setStep = (key: FinishingStepKey, value: boolean) =>
    startTransition(async () => {
      await updateBatchField(batchId, seasonId, key, value);
      router.refresh();
    });
  const saveComment = (value: string) =>
    startTransition(async () => {
      await updateBatchField(batchId, seasonId, "fin_comment", value || null);
      router.refresh();
    });
  const markFinished = () =>
    startTransition(async () => {
      await updateBatchField(batchId, seasonId, "fin_status", "finished");
      router.refresh();
    });

  const allDone = FINISHING_STEPS.every((s) => steps[s.key]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {FINISHING_STEPS.map((s) => {
          const done = steps[s.key];
          return (
            <button
              key={s.key}
              disabled={isPending}
              onClick={() => setStep(s.key, !done)}
              className={`text-xs px-2.5 py-1 rounded font-medium disabled:opacity-50 ${
                done
                  ? "bg-gray-200 text-gray-400 line-through"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <textarea
        defaultValue={comment}
        maxLength={200}
        rows={2}
        placeholder="Comment (max 200 chars)…"
        onBlur={(e) => {
          if (e.target.value !== comment) saveComment(e.target.value);
        }}
        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
      />

      {allDone && (
        <div className="sm:text-right">
          <button
            disabled={isPending}
            onClick={markFinished}
            className="text-[11px] px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
          >
            ✓ Mark Finished
          </button>
        </div>
      )}
    </div>
  );
}
