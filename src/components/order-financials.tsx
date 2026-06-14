"use client";

import { useState, useEffect, useRef } from "react";
import { calcCustomerWholesaleEur } from "@/lib/pricing";
import { saveOrderFinancials } from "@/app/actions/order-financials";
import { fmtEur } from "@/lib/format";

type OrderItem = {
  id:             string;
  retailPriceEur: number;
  totalQty:       number;
};

type Props = {
  orderId:             string;
  initialDiscountRate: number;
  initialDepositRate:  number;
  exchangeRate:        number | null;  // from season — read-only
  taxRate:             number;         // 0.10 if tax_included, else 0 — read-only
  isTax:               boolean;        // = customers.tax_included
  currency:            string;         // "EUR" | "JPY" (customers.currency)
  items:               OrderItem[];
};

export function OrderFinancials({
  orderId,
  initialDiscountRate,
  initialDepositRate,
  exchangeRate,
  taxRate,
  isTax,
  currency,
  items,
}: Props) {
  const isJpyCust = currency === "JPY";
  const [discountPct, setDiscountPct] = useState(Math.round(initialDiscountRate * 100));
  const [depositPct,  setDepositPct]  = useState(Math.round(initialDepositRate  * 100));
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const latestRef = useRef({ discountPct, depositPct });
  latestRef.current = { discountPct, depositPct };
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSaved(false);
    const timer = setTimeout(async () => {
      const { discountPct: d, depositPct: dep } = latestRef.current;
      setSaving(true); setError(null);
      const result = await saveOrderFinancials(orderId, d / 100, dep / 100, exchangeRate, taxRate);
      if (result) setError(result); else setSaved(true);
      setSaving(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [discountPct, depositPct]);

  // Live calculations
  const discountRate = discountPct / 100;
  const depositRate  = depositPct  / 100;
  const exRate       = exchangeRate && exchangeRate > 0 ? exchangeRate : null;

  const subtotalRetailEur   = items.reduce((s, i) => s + i.retailPriceEur * i.totalQty, 0);
  const subtotalCustomerEur = items.reduce((s, i) => s + calcCustomerWholesaleEur(i.retailPriceEur, discountRate) * i.totalQty, 0);
  const taxAmount           = subtotalCustomerEur * taxRate;
  const totalWithTax        = subtotalCustomerEur + taxAmount;

  // JPY — convert the wholesale subtotal first (floor 1,000), then compute tax
  // and total in JPY on that basis (matches the OC / invoice rule).
  const jpy = (eur: number) => exRate ? Math.floor(eur * exRate / 1000) * 1000 : null;
  const subtotalRetailJpy   = jpy(subtotalRetailEur);
  const subtotalCustomerJpy = jpy(subtotalCustomerEur);
  const taxAmountJpy        = subtotalCustomerJpy !== null ? Math.floor(subtotalCustomerJpy * taxRate / 1000) * 1000 : null;
  const totalWithTaxJpy     = subtotalCustomerJpy !== null ? subtotalCustomerJpy + (taxAmountJpy ?? 0) : null;

  // Deposit based on totalWithTax (what the customer actually owes)
  const depositAmountEur = totalWithTax * depositRate;
  const balanceDue       = totalWithTax - depositAmountEur;

  // Deposit JPY — share of the JPY total, floored to 1,000
  const depositAmountJpy = totalWithTaxJpy !== null ? Math.floor(totalWithTaxJpy * depositRate / 1000) * 1000 : null;
  const balanceDueJpy    = totalWithTaxJpy !== null && depositAmountJpy !== null ? totalWithTaxJpy - depositAmountJpy : null;

  return (
    <div className="space-y-3">
      {/* Auto-save indicator */}
      <div className="flex justify-end text-xs h-4">
        {saving           && <span className="text-gray-400 animate-pulse">Saving…</span>}
        {!saving && saved && <span className="text-green-600">✓ Saved</span>}
        {error            && <span className="text-red-500">{error}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* ── Pricing ── */}
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pricing</p>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs mb-1.5">
            <span />
            <span className="text-gray-400 font-medium text-right w-24">EUR</span>
            <span className="text-gray-400 font-medium text-right w-24">JPY</span>
          </div>

          {/* Subtotal Retail */}
          <AmountRow
            label="Subtotal (Retail)"
            eur={`€ ${fmtEur(subtotalRetailEur)}`}
            jpy={subtotalRetailJpy}
          />

          {/* Discount input */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1.5">
            <span className="text-gray-500 flex items-center gap-1.5">
              Discount
            </span>
            <div className="flex items-center gap-1 w-24 justify-end">
              <input
                type="number" min="0" max="100" step="1"
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-gray-400">%</span>
            </div>
            <span className="w-24" />
          </div>

          {/* Customer WS */}
          <AmountRow
            label={`Customer WS (−${discountPct}%)`}
            eur={`€ ${fmtEur(subtotalCustomerEur)}`}
            jpy={subtotalCustomerJpy}
          />

          {/* Tax */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1.5">
            <span className="text-gray-500 flex items-center gap-1.5">
              Tax
              <span className={`px-1.5 py-0.5 rounded font-medium ${isTax ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"}`}>
                {isTax ? "10%" : "0%"}
              </span>
            </span>
            <span className="font-mono text-gray-500 text-right w-24">€ {fmtEur(taxAmount)}</span>
            <span className="font-mono text-gray-400 text-right w-24">
              {taxAmountJpy !== null ? `¥ ${taxAmountJpy.toLocaleString()}` : "—"}
            </span>
          </div>

          {/* Total */}
          <div className="border-t border-gray-200 pt-2 mt-1">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1">
              <span className="text-gray-700 font-semibold">Total (incl. Tax)</span>
              <span className="font-mono font-semibold text-gray-900 text-right w-24">
                {isJpyCust ? "—" : `€ ${fmtEur(totalWithTax)}`}
              </span>
              <span className="font-mono font-semibold text-gray-700 text-right w-24">
                {totalWithTaxJpy !== null ? `¥ ${totalWithTaxJpy.toLocaleString()}` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Deposit ── */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Deposit</p>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Rate</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100" step="1"
                value={depositPct}
                onChange={(e) => setDepositPct(Number(e.target.value))}
                className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Exchange Rate</span>
            <span className="text-xs font-mono text-gray-500">
              {exRate ? `¥ ${exRate.toLocaleString("en-US")} / €1` : "—"}
            </span>
          </div>

          {/* EUR / JPY side-by-side table */}
          <div className="border-t border-gray-200 pt-3">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs mb-1.5">
              <span />
              <span className="text-gray-400 font-medium text-right w-24">EUR</span>
              <span className="text-gray-400 font-medium text-right w-24">JPY</span>
            </div>
            {/* Deposit row */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1.5">
              <span className="text-gray-500">Deposit ({depositPct}%)</span>
              <span className="font-mono text-gray-700 text-right w-24">€ {fmtEur(depositAmountEur)}</span>
              <span className="font-mono text-gray-500 text-right w-24">
                {depositAmountJpy !== null ? `¥ ${depositAmountJpy.toLocaleString()}` : "—"}
              </span>
            </div>
            {/* Balance row */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1.5 border-t border-gray-100">
              <span className="text-gray-500">Balance ({100 - depositPct}%)</span>
              <span className="font-mono font-semibold text-gray-900 text-right w-24">€ {fmtEur(balanceDue)}</span>
              <span className="font-mono font-semibold text-gray-700 text-right w-24">
                {balanceDueJpy !== null ? `¥ ${balanceDueJpy.toLocaleString()}` : "—"}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function AmountRow({ label, eur, jpy }: { label: string; eur: string; jpy: number | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-mono text-gray-700 text-right w-24">{eur}</span>
      <span className="font-mono text-gray-400 text-right w-24">
        {jpy !== null ? `¥ ${jpy.toLocaleString()}` : "—"}
      </span>
    </div>
  );
}
