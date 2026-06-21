"use client";

import { useState } from "react";
import { PRODUCTION_STAGES, type StageKey } from "@/lib/production-constants";
import { toggleProductionStage } from "@/app/actions/production-progress";

type ProgressRow = {
  productId: string;
  productName: string;
  productNumber: string | null;
  stages: Record<StageKey, boolean>;
};

type Props = {
  seasonId: string;
  rows: ProgressRow[];
};

export function ProductionGrid({ seasonId, rows: initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(productId: string, stage: StageKey, currentValue: boolean) {
    const key = `${productId}-${stage}`;
    setSaving(key);
    const newValue = !currentValue;
    setRows((prev) =>
      prev.map((r) =>
        r.productId === productId
          ? { ...r, stages: { ...r.stages, [stage]: newValue } }
          : r
      )
    );
    await toggleProductionStage(productId, seasonId, stage, newValue);
    setSaving(null);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Product No.</th>
            {PRODUCTION_STAGES.map((s) => (
              <th key={s.key} className="text-center px-3 py-3 font-medium text-gray-600 text-xs">{s.label}</th>
            ))}
            <th className="text-center px-4 py-3 font-medium text-gray-600 text-xs">Complete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const allDone = PRODUCTION_STAGES.every((s) => row.stages[s.key]);
            return (
              <tr key={row.productId} className={`hover:bg-gray-50 ${allDone ? "bg-green-50" : ""}`}>
                <td className="px-4 py-3 text-gray-900">{row.productName}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{row.productNumber ?? "—"}</td>
                {PRODUCTION_STAGES.map((s) => {
                  const done = row.stages[s.key];
                  const key = `${row.productId}-${s.key}`;
                  return (
                    <td key={s.key} className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(row.productId, s.key, done)}
                        disabled={saving === key}
                        className={`w-8 h-8 rounded transition-colors ${
                          done
                            ? "bg-green-500 text-white hover:bg-green-600"
                            : "bg-gray-100 text-gray-300 hover:bg-gray-200"
                        } disabled:opacity-50`}
                      >
                        {done ? "✓" : "·"}
                      </button>
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {allDone ? (
                    <span className="text-xs text-green-600 font-medium">Complete</span>
                  ) : (
                    <span className="text-xs text-gray-300">{PRODUCTION_STAGES.filter((s) => row.stages[s.key]).length}/5</span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">
                No products
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
