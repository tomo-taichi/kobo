"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDepositPdf } from "@/app/actions/pdf-storage";

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function DepositGenerateButton({ orderId, savedUrl: initialSavedUrl }: { orderId: string; savedUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [savedUrl, setSavedUrl] = useState(initialSavedUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await saveDepositPdf(orderId, deadline || null);
      if ("url" in result) {
        setSavedUrl(result.url);
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="text-sm px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700"
        >
          Generate & Save
        </button>
        {savedUrl && (
          <a href={savedUrl} target="_blank" rel="noreferrer"
            className="text-sm px-3 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
            Download saved
          </a>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !isPending && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Advance Invoice</h3>
            <p className="text-xs text-gray-400 mb-3">Set the advance payment deadline (default: today + 7 days).</p>

            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Deadline</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 mb-4"
            />

            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isPending}
                className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {isPending ? "Generating…" : "Generate & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
