"use client";

import { useState } from "react";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-constants";
import { updateOrderStatus } from "@/app/actions/orders";

const STATUS_DESCRIPTIONS: Record<string, string> = {
  A: "Order Confirmation sent to customer",
  B: "Customer approved the Order Confirmation",
  C: "Deposit payment confirmed",
  D: "Final invoice sent to customer",
  E: "Full payment confirmed",
  F: "Commercial invoice issued — shipment complete",
};

const STATUS_COLORS: Record<string, string> = {
  A: "bg-gray-100 text-gray-700",
  B: "bg-blue-100 text-blue-800",
  C: "bg-yellow-100 text-yellow-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-purple-100 text-purple-800",
  F: "bg-green-100 text-green-800",
};

type Props = { orderId: string; currentStatus: string; compact?: boolean };

export function OrderStatusSelector({ orderId, currentStatus, compact = false }: Props) {
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: string) {
    setSaving(true);
    setStatus(newStatus);
    await updateOrderStatus(orderId, newStatus);
    setSaving(false);
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleChange(s)}
            disabled={saving}
            title={STATUS_DESCRIPTIONS[s]}
            className={`text-xs px-2.5 py-1 rounded border transition-colors ${
              s === status
                ? `${STATUS_COLORS[s]} border-transparent font-medium`
                : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
            } disabled:opacity-50`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
      <p className="text-xs text-gray-500">{STATUS_DESCRIPTIONS[status]}</p>
      <div className="flex gap-2 flex-wrap">
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleChange(s)}
            disabled={saving}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              s === status
                ? `${STATUS_COLORS[s]} border-transparent font-medium`
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            } disabled:opacity-50`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-2">
        <p className="text-xs text-gray-400">
          {ORDER_STATUSES.map((s) => `${s}: ${STATUS_DESCRIPTIONS[s]}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}
