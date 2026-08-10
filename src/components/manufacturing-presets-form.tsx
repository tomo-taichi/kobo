"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateManufacturingPresets } from "@/app/actions/company-settings";
import {
  MANUFACTURING_CATEGORIES,
  MANUFACTURING_COST_LABELS,
  formatHours,
  type ManufacturingCostKey,
  type ManufacturingHourPresets,
} from "@/lib/presets";

// ADR-0009 Phase 3 (Settings › Manufacturing Autofill) — edit the hours-per-garment
// preset matrix. Read-only until "Edit"; Save enabled only when something changed.
export function ManufacturingPresetsForm({ presets }: { presets: ManufacturingHourPresets }) {
  const [editing, setEditing] = useState(false);
  const [matrix, setMatrix] = useState<ManufacturingHourPresets>(presets);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const keys = Object.keys(MANUFACTURING_COST_LABELS) as ManufacturingCostKey[];
  const dirty = keys.some((k) => MANUFACTURING_CATEGORIES.some((g) => matrix[k][g] !== presets[k][g]));

  const setCell = (k: ManufacturingCostKey, g: (typeof MANUFACTURING_CATEGORIES)[number], v: number) =>
    setMatrix((m) => ({ ...m, [k]: { ...m[k], [g]: v } }));

  const startEdit = () => {
    setMatrix(presets);
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setMatrix(presets);
    setError(null);
    setEditing(false);
  };
  const save = () =>
    startTransition(async () => {
      const err = await updateManufacturingPresets(matrix);
      if (err) {
        setError(err);
      } else {
        setEditing(false);
        router.refresh();
      }
    });

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex justify-end">
        {!editing && (
          <button onClick={startEdit} className="text-xs px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100">
            Edit
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-medium text-gray-500 sticky left-0 bg-white z-10">Step \ Category</th>
              {MANUFACTURING_CATEGORIES.map((g) => (
                <th key={g} className="px-2 py-1 font-medium text-gray-500 whitespace-nowrap">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td className="px-2 py-1 text-gray-700 whitespace-nowrap sticky left-0 bg-white z-10">{MANUFACTURING_COST_LABELS[k]}</td>
                {MANUFACTURING_CATEGORIES.map((g) => (
                  <td key={g} className="px-1 py-1 text-center">
                    {editing ? (
                      <input
                        type="number" min="0" step="0.1" value={matrix[k][g]}
                        onChange={(e) => setCell(k, g, Number(e.target.value))}
                        className="w-16 px-1 py-0.5 border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
                      />
                    ) : (
                      <span className="font-mono text-gray-900">{formatHours(matrix[k][g])}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">Work hours per product category. Used by “Autofill” on the product cost form. Scroll sideways to reach every category.</p>

      {editing && (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending || !dirty}
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
