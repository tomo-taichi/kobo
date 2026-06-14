"use client";

import { useState } from "react";
import { saveMaterialOrder } from "@/app/actions/material-orders";

type Props = {
  seasonId: string;
  materialId: string;
  materialName: string;
  unitType: string;
  totalUsage: number;
  initialSampleRemaining: number;
  initialOrderQty: number;
  initialNotes: string | null;
};

export function MaterialOrderRow({
  seasonId,
  materialId,
  materialName,
  unitType,
  totalUsage,
  initialSampleRemaining,
  initialOrderQty,
  initialNotes,
}: Props) {
  const [sampleRemaining, setSampleRemaining] = useState(initialSampleRemaining);
  const [orderQty, setOrderQty] = useState(initialOrderQty);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const netRequirement = Math.max(0, totalUsage - sampleRemaining);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await saveMaterialOrder(seasonId, materialId, sampleRemaining, orderQty, notes || null);
    setSaving(false);
    setSaved(true);
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-900">{materialName}</td>
      <td className="px-4 py-3 text-right font-mono text-gray-700">
        {totalUsage.toFixed(2)} {unitType}
      </td>
      <td className="px-4 py-3">
        <input
          type="number" min="0" step="0.01" value={sampleRemaining}
          onChange={(e) => setSampleRemaining(Number(e.target.value))}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </td>
      <td className="px-4 py-3 text-right font-mono text-blue-700">
        {netRequirement.toFixed(2)} {unitType}
      </td>
      <td className="px-4 py-3">
        <input
          type="number" min="0" step="0.01" value={orderQty}
          onChange={(e) => setOrderQty(Number(e.target.value))}
          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="メモ..."
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {saved && <span className="text-xs text-green-600">✓</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "..." : "保存"}
          </button>
        </div>
      </td>
    </tr>
  );
}
