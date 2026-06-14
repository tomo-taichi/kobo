"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentEntry } from "@/app/actions/customer-payments";

type Order = { id: string; order_date: string | null; seasons: { name: string } | null };

const inputCls  = "px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
const selectCls = inputCls + " bg-white";

export function CustomerPaymentNew({
  customerId,
  orders,
}: {
  customerId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const err = await createPaymentEntry(null, fd);
      if (err) {
        setError(err);
      } else {
        setError(null);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700"
        >
          + Add Entry
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3 items-end"
        >
          <input type="hidden" name="customer_id" value={customerId} />

          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              name="entry_date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select name="type" defaultValue="debit" className={selectCls}>
              <option value="debit">Debit (Invoice)</option>
              <option value="credit">Credit (Payment)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount</label>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className={inputCls + " w-28"}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Currency</label>
            <select name="currency" defaultValue="EUR" className={selectCls}>
              <option value="EUR">EUR</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Order (optional)</label>
            <select name="order_id" className={selectCls}>
              <option value="">—</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_date ?? "—"} {(o.seasons as { name: string } | null)?.name ?? ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input type="text" name="note" className={inputCls + " w-full"} placeholder="Memo..." />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
