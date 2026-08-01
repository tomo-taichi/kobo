"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePricingSettings } from "@/app/actions/company-settings";

// ADR-0009 Phase 3 (Settings › Pricing) — global default EUR rate + labor rate.
// Read-only until "Edit"; Save is enabled only when a value actually changed.
export function PricingSettingsForm({ costEurRate, laborRate }: { costEurRate: number; laborRate: number }) {
  const [editing, setEditing] = useState(false);
  const [eur, setEur] = useState(String(costEurRate));
  const [labor, setLabor] = useState(String(laborRate));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = Number(eur) !== costEurRate || Number(labor) !== laborRate;
  const valid = Number(eur) > 0 && Number(labor) > 0;

  const startEdit = () => {
    setEur(String(costEurRate));
    setLabor(String(laborRate));
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setEur(String(costEurRate));
    setLabor(String(laborRate));
    setError(null);
    setEditing(false);
  };
  const save = () =>
    startTransition(async () => {
      const err = await updatePricingSettings(Number(eur), Number(labor));
      if (err) {
        setError(err);
      } else {
        setEditing(false);
        router.refresh();
      }
    });

  const inputCls = "w-40 px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-end mb-2">
        {!editing && (
          <button onClick={startEdit} className="text-xs px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100">
            Edit
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Default EUR rate (¥ / €)</label>
          {editing ? (
            <input type="number" min="0" step="1" value={eur} onChange={(e) => setEur(e.target.value)} className={inputCls} />
          ) : (
            <div className="text-sm text-gray-900 font-mono">{costEurRate}</div>
          )}
          <p className="text-[11px] text-gray-400 mt-1">Used on the product cost form when a product has no rate of its own.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Labor rate (¥ / hour)</label>
          {editing ? (
            <input type="number" min="0" step="100" value={labor} onChange={(e) => setLabor(e.target.value)} className={inputCls} />
          ) : (
            <div className="text-sm text-gray-900 font-mono">{laborRate}</div>
          )}
          <p className="text-[11px] text-gray-400 mt-1">Manufacturing amount = work hours × this rate.</p>
        </div>
      </div>

      {editing && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={save}
            disabled={isPending || !dirty || !valid}
            className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={cancel} disabled={isPending} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}
    </div>
  );
}
