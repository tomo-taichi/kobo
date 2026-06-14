"use client";

import { useActionState, useState } from "react";
import { INVOICE_TYPES, INVOICE_TYPE_LABELS } from "@/lib/order-constants";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;
type CustomerOption = { id: string; name: string; currency: string };
type SeasonOption   = { id: string; name: string; eur_jpy_rate: number | null };

type Props = {
  action:    Action;
  customers: CustomerOption[];
  seasons:   SeasonOption[];
  defaultOrderDate?: string;
  initialData?: {
    customer_id?:   string;
    season_id?:     string;
    order_date?:    string | null;
    invoice_type?:  string;
    currency_type?: string;
    exchange_rate?: number | null;
    notes?:         string | null;
  };
  id?: string;
};

export function OrderForm({
  action, customers, seasons, defaultOrderDate, initialData = {}, id,
}: Props) {
  const [error, formAction, pending] = useActionState(action, null);

  const [customerId, setCustomerId] = useState(initialData.customer_id ?? "");
  const [seasonId,   setSeasonId]   = useState(initialData.season_id   ?? "");
  const [orderDate,  setOrderDate]  = useState(initialData.order_date  ?? defaultOrderDate ?? "");

  const customer = customers.find((c) => c.id === customerId);
  const season   = seasons.find((s)   => s.id === seasonId);

  // Derive read-only values: use live selection, fall back to stored initial when not changed yet
  const currency     = customer?.currency    ?? initialData.currency_type  ?? "EUR";
  const exchangeRate = season?.eur_jpy_rate  ?? initialData.exchange_rate  ?? null;

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-2xl">
      {id && <input type="hidden" name="id" value={id} />}
      {/* Auto-derived values submitted as hidden fields */}
      <input type="hidden" name="currency_type" value={currency} />
      <input type="hidden" name="exchange_rate"  value={exchangeRate ?? ""} />

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
          <select
            name="customer_id"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Select...</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Currency — auto from customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700">
            {customerId ? currency : <span className="text-gray-400">— select customer first —</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Season */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Season *</label>
          <select
            name="season_id"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">Select...</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Exchange Rate — auto from season */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate (JPY/EUR)</label>
          <div className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700 font-mono">
            {seasonId
              ? (exchangeRate != null ? `¥ ${exchangeRate}` : <span className="text-gray-400">Not set for this season</span>)
              : <span className="text-gray-400">— select season first —</span>
            }
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Order Date — defaults to today */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
          <input
            type="date"
            name="order_date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {/* Invoice Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
          <select
            name="invoice_type"
            defaultValue={initialData.invoice_type ?? "Original"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {INVOICE_TYPES.map((t) => (
              <option key={t} value={t}>{INVOICE_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={initialData.notes ?? ""}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 w-fit"
      >
        {pending ? "Saving..." : id ? "Update" : "Create Order"}
      </button>
    </form>
  );
}
