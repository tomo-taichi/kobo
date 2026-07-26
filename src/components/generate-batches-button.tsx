"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateProductionBatches } from "@/app/actions/production-batches";

// ADR-0009 Phase 3 — manually (re)generate production_batches from a season's orders.
// Idempotent: progress/assignee fields on existing batches are preserved.
export function GenerateBatchesButton({ seasonId }: { seasonId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await generateProductionBatches(seasonId);
            if ("error" in r) {
              setMsg(`Error: ${r.error}`);
            } else {
              setMsg(
                `${r.batches} batches · ${r.linkedItems} lines linked` +
                  (r.skippedNoColour ? ` · ${r.skippedNoColour} skipped (no colour)` : "")
              );
            }
            router.refresh();
          })
        }
        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate / Refresh Batches"}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}
