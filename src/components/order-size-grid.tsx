"use client";

import { useState, useEffect, useRef } from "react";
import { SIZES } from "@/lib/order-constants";
import { updateOrderItemSizes, removeOrderItem } from "@/app/actions/order-items";
import { fmtEur } from "@/lib/format";

type SizeEntry = { size: string; quantity: number };

type Props = {
  orderId:              string;
  orderItemId:          string;
  productName:          string;
  productNumber:        string | null;
  modelName:            string | null;
  mainMName:            string | null;
  mainMColor:           string | null;
  retailPriceEur:       number;
  customerWholesaleEur: number;
  initialSizes:         SizeEntry[];
};

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/^P/i, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return raw;
  return "P" + String(n).padStart(6, "0");
}

export function OrderSizeGrid({
  orderId,
  orderItemId,
  productName,
  productNumber,
  modelName,
  mainMName,
  mainMColor,
  retailPriceEur,
  initialSizes,
}: Props) {
  const sizeMap = new Map(initialSizes.map((s) => [s.size, s.quantity]));
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(SIZES.map((s) => [s, sizeMap.get(s) ?? 0]))
  );
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [removing, setRemoving] = useState(false);

  const latestRef     = useRef(quantities);
  latestRef.current   = quantities;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSaved(false);
    const timer = setTimeout(async () => {
      setSaving(true);
      await updateOrderItemSizes(
        orderId,
        orderItemId,
        SIZES.map((s) => ({ size: s, quantity: latestRef.current[s] ?? 0 }))
      );
      setSaving(false);
      setSaved(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [quantities]);

  const totalQty  = Object.values(quantities).reduce((a, b) => a + b, 0);
  const lineTotal = retailPriceEur * totalQty;

  async function handleRemove() {
    if (!confirm(`Remove "${modelName ?? productName}" from this order?`)) return;
    setRemoving(true);
    await removeOrderItem(orderId, orderItemId);
  }

  return (
    <tr className={`border-b border-gray-100 last:border-0 transition-colors ${removing ? "opacity-40" : "hover:bg-gray-50/60"}`}>
      {/* Product info */}
      <td className="px-3 py-2 font-mono text-xs text-gray-400 whitespace-nowrap">{fmtId(productNumber)}</td>
      <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{modelName ?? productName}</td>
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{mainMName ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{mainMColor ?? "—"}</td>
      <td className="px-3 py-2 text-xs font-mono text-gray-700 text-right whitespace-nowrap">€ {fmtEur(retailPriceEur, 0)}</td>

      {/* Size inputs */}
      {SIZES.map((size) => {
        const qty = quantities[size] ?? 0;
        return (
          <td key={size} className="px-0.5 py-2">
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) =>
                setQuantities((prev) => ({ ...prev, [size]: Math.max(0, Number(e.target.value)) }))
              }
              className={`w-9 h-7 text-xs text-center border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors ${
                qty >= 1
                  ? "border-blue-300 text-blue-600 font-semibold bg-blue-50"
                  : "border-gray-200 text-gray-300 bg-white"
              }`}
            />
          </td>
        );
      })}

      {/* Subtotal */}
      <td className="px-3 py-2 text-xs font-mono text-right whitespace-nowrap">
        {totalQty > 0 ? (
          <span className="text-gray-700">{totalQty} pcs · € {fmtEur(lineTotal, 0)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Status + Remove */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 justify-end">
          {saving  && <span className="text-xs text-gray-300 animate-pulse">●</span>}
          {!saving && saved && <span className="text-xs text-green-500">✓</span>}
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-sm text-gray-300 hover:text-red-500 disabled:opacity-50 leading-none px-1"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}
