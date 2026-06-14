"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFinalInvoicePdf, saveCommercialPdf, type BatchOpts } from "@/app/actions/pdf-storage";

export type BatchItem = { id: string; productId: string; modelName: string; color: string | null; qty: number; processed: boolean };
export type BatchDoc = { documentId: string; seqNo: number; itemIds: string[]; versionLabel: string | null };

type Props = {
  orderId: string;
  docType: "final" | "commercial" | "delivery";
  items: BatchItem[];
  existingDocs: BatchDoc[];
  savedUrl: string | null;
};

export function BatchGenerateButton({ orderId, docType, items, existingDocs, savedUrl: initialSavedUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "revise">("new");
  const [reviseDocId, setReviseDocId] = useState<string>(existingDocs[0]?.documentId ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedUrl, setSavedUrl] = useState(initialSavedUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // "Processed" (already invoiced / delivered) comes from the item flags
  const available = useMemo(() => items.filter((i) => !i.processed), [items]);

  // Items shown depend on mode: New → not-yet-processed; Revise → the chosen batch's items
  const reviseDoc = existingDocs.find((d) => d.documentId === reviseDocId);
  const visibleItems = mode === "new"
    ? available
    : items.filter((i) => (reviseDoc?.itemIds ?? []).includes(i.id));

  function openModal() {
    setError(null);
    setMode("new");
    setSelected(new Set(available.map((i) => i.id))); // preselect all available
    setOpen(true);
  }

  function switchMode(m: "new" | "revise") {
    setMode(m);
    if (m === "revise") {
      const d = existingDocs.find((x) => x.documentId === reviseDocId) ?? existingDocs[0];
      setReviseDocId(d?.documentId ?? "");
      setSelected(new Set(d?.itemIds ?? []));
    } else {
      setSelected(new Set(available.map((i) => i.id)));
    }
  }

  function pickRevise(id: string) {
    setReviseDocId(id);
    const d = existingDocs.find((x) => x.documentId === id);
    setSelected(new Set(d?.itemIds ?? []));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleGenerate() {
    if (selected.size === 0) { setError("Select at least one item."); return; }
    const opts: BatchOpts =
      mode === "revise"
        ? { mode: "revise", documentId: reviseDocId, itemIds: [...selected] }
        : { mode: "new", itemIds: [...selected] };
    setError(null);
    startTransition(async () => {
      const result = docType === "final"
        ? await saveFinalInvoicePdf(orderId, opts)
        : await saveCommercialPdf(orderId, docType === "commercial", opts);
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
        <button onClick={openModal} className="text-sm px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700">
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
          <div className="bg-white rounded-lg shadow-xl w-[460px] max-h-[80vh] flex flex-col p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Select items for this batch</h3>
            <p className="text-xs text-gray-400 mb-3">Choose which products to include. Already-processed items are hidden in New.</p>

            {/* Mode */}
            <div className="flex gap-3 mb-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === "new"} onChange={() => switchMode("new")} />
                New batch
              </label>
              <label className={`flex items-center gap-1.5 ${existingDocs.length === 0 ? "text-gray-300" : ""}`}>
                <input type="radio" checked={mode === "revise"} disabled={existingDocs.length === 0} onChange={() => switchMode("revise")} />
                Revise existing
              </label>
            </div>

            {mode === "revise" && (
              <select
                value={reviseDocId}
                onChange={(e) => pickRevise(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-3"
              >
                {existingDocs.map((d) => (
                  <option key={d.documentId} value={d.documentId}>
                    Batch {d.seqNo}{d.versionLabel ? ` · ${d.versionLabel}` : ""} ({d.itemIds?.length ?? 0} items)
                  </option>
                ))}
              </select>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded divide-y divide-gray-100 mb-3">
              {visibleItems.length === 0 ? (
                <p className="px-3 py-6 text-sm text-gray-400 text-center">
                  {mode === "new" ? "All items already processed." : "No items in this batch."}
                </p>
              ) : visibleItems.map((i) => (
                <label key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                  <span className="font-mono text-xs text-gray-400 w-16">{i.productId}</span>
                  <span className="flex-1 text-gray-800">{i.modelName}{i.color ? <span className="text-gray-400"> · {i.color}</span> : null}</span>
                  <span className="text-gray-400 text-xs">×{i.qty}</span>
                </label>
              ))}
            </div>

            {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">{selected.size} selected</span>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} disabled={isPending}
                  className="text-sm px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={handleGenerate} disabled={isPending || selected.size === 0}
                  className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">
                  {isPending ? "Generating…" : "Generate & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
