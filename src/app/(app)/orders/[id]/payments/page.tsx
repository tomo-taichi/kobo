import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerPaymentNew } from "@/components/customer-payment-new";
import { CustomerPaymentDelete } from "@/components/customer-payment-delete";

const CATEGORY_LABELS: Record<string, string> = { deposit: "Deposit", balance: "Balance", other: "Other" };

export default async function OrderPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, customers(currency)")
    .eq("id", id)
    .single();
  if (!order) notFound();

  const o: any = order;
  const currency = o.customers?.currency === "JPY" ? "JPY" : "EUR";
  const sym = currency === "JPY" ? "¥" : "€";

  const { data: entries } = await supabase
    .from("customer_payments")
    .select("id, entry_date, type, category, amount, currency, note")
    .eq("order_id", id)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  let invoiced = 0;
  let paid = 0;
  for (const e of entries ?? []) {
    if (e.type === "debit") invoiced += Number(e.amount);
    if (e.type === "credit") paid += Number(e.amount);
  }
  const balance = invoiced - paid;

  const fmt = (n: number, cur: string) => {
    const s = cur === "JPY" ? "¥" : "€";
    return `${s}${n.toLocaleString("en", cur === "JPY" ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-4">
      {/* Header: add entry + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <CustomerPaymentNew customerId={o.customer_id} orders={[]} lockedOrderId={id} />
        <div className="flex gap-6 text-sm">
          <span className="text-gray-500">Invoiced: <span className="font-semibold text-orange-700">{fmt(invoiced, currency)}</span></span>
          <span className="text-gray-500">Paid: <span className="font-semibold text-green-700">{fmt(paid, currency)}</span></span>
          <span className={`font-semibold ${balance > 0 ? "text-orange-600" : "text-green-700"}`}>
            Balance: {balance < 0 ? "-" : ""}{fmt(Math.abs(balance), currency)}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {!(entries ?? []).length ? (
          <p className="px-5 py-8 text-sm text-gray-400">No payment history for this order yet. Issuing an invoice (Advance / Final) automatically records a debit.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Type</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Category</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Note</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Invoiced</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Paid</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(entries ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700 text-xs">{e.entry_date}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.type === "debit" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>
                      {e.type === "debit" ? "Debit" : "Credit"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.note ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-xs">
                    {e.type === "debit" ? <span className="text-orange-700 font-medium">{fmt(Number(e.amount), e.currency)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {e.type === "credit" ? <span className="text-green-700 font-medium">{fmt(Number(e.amount), e.currency)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <CustomerPaymentDelete entryId={e.id} customerId={o.customer_id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
