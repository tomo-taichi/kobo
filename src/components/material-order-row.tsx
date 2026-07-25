"use client";

import { useState } from "react";
import { saveMaterialOrder } from "@/app/actions/material-orders";
import type { UsageLine } from "@/lib/material-usage";

type Props = {
  seasonId: string;
  materialColorId: string;
  materialId: string;
  materialNumber: string | null;
  materialName: string;
  colour: string;
  unitType: string;
  totalUsage: number;
  initialSampleRemaining: number;
  initialOrderQty: number;
  initialNotes: string | null;
  lines: UsageLine[];
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MaterialOrderRow({
  seasonId,
  materialColorId,
  materialId,
  materialNumber,
  materialName,
  colour,
  unitType,
  totalUsage,
  initialSampleRemaining,
  initialOrderQty,
  initialNotes,
  lines,
}: Props) {
  const [sampleRemaining, setSampleRemaining] = useState(initialSampleRemaining);
  const [orderQty, setOrderQty] = useState(initialOrderQty);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Baseline of the last persisted values — Save appears only when the row differs from it.
  const [baseline, setBaseline] = useState({
    sampleRemaining: initialSampleRemaining,
    orderQty: initialOrderQty,
    notes: initialNotes ?? "",
  });
  const dirty =
    sampleRemaining !== baseline.sampleRemaining ||
    orderQty !== baseline.orderQty ||
    notes !== baseline.notes;

  const netRequirement = Math.max(0, totalUsage - sampleRemaining);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await saveMaterialOrder(seasonId, materialColorId, materialId, sampleRemaining, orderQty, notes || null);
    setBaseline({ sampleRemaining, orderQty, notes });
    setSaving(false);
    setSaved(true);
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-gray-900">{materialName}</td>
        <td className="px-4 py-3 text-gray-700">{colour}</td>
        <td className="px-4 py-3 text-right font-mono text-gray-700">
          {totalUsage.toFixed(2)} {unitType}
        </td>
        <td className="px-4 py-3">
          <input
            type="number" min="0" step="0.01" value={sampleRemaining}
            onChange={(e) => { setSampleRemaining(Number(e.target.value)); setSaved(false); }}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </td>
        <td className="px-4 py-3 text-right font-mono text-blue-700">
          {netRequirement.toFixed(2)} {unitType}
        </td>
        <td className="px-4 py-3">
          <input
            type="number" min="0" step="0.01" value={orderQty}
            onChange={(e) => { setOrderQty(Number(e.target.value)); setSaved(false); }}
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text" value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
            placeholder="Notes..."
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {saved && !dirty && <span className="text-xs text-green-600">✓</span>}
            <button
              onClick={() => setDetailOpen(true)}
              className="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
            >
              Detail
            </button>
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? "..." : "Save"}
              </button>
            )}
          </div>
        </td>
      </tr>

      {detailOpen && (
        <tr>
          <td colSpan={8} className="p-0">
            <UsageDetailModal
              materialNumber={materialNumber}
              materialName={materialName}
              colour={colour}
              unitType={unitType}
              totalUsage={totalUsage}
              lines={lines}
              onClose={() => setDetailOpen(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function UsageDetailModal({
  materialNumber,
  materialName,
  colour,
  unitType,
  totalUsage,
  lines,
  onClose,
}: {
  materialNumber: string | null;
  materialName: string;
  colour: string;
  unitType: string;
  totalUsage: number;
  lines: UsageLine[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-sm text-gray-500">
              Usage detail {materialNumber ? `· M.ID ${materialNumber}` : ""}
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {materialName} <span className="text-gray-500 font-normal">/ {colour}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="overflow-auto">
          {lines.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No order lines consume this material colour.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Order</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">P.ID</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Role</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Per Unit</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Sizes</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Units</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      <div>{l.orderNumber ?? "—"}</div>
                      {l.customerName ? <div className="text-xs text-gray-400">{l.customerName}</div> : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-600">{l.productNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-900">
                      <div>{l.modelName}</div>
                      {l.productCategory ? <div className="text-xs text-gray-400">{l.productCategory}</div> : null}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{l.role}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">{fmt(l.perUnitUsage)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                      {l.sizes.map((s) => `${s.size}:${s.qty}`).join("  ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{l.units}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-900">{fmt(l.lineTotal)} {unitType}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={7} className="px-4 py-2 text-right font-medium text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                    {fmt(totalUsage)} {unitType}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 text-right">
          <button onClick={onClose} className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
