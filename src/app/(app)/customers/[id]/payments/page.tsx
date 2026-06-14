import { createClient } from "@/lib/supabase/server";
import { CustomerPaymentNew } from "@/components/customer-payment-new";
import { CustomerPaymentDelete } from "@/components/customer-payment-delete";

export default async function CustomerPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch payments and orders separately to avoid complex PostgREST joins
  const [{ data: entries }, { data: orders }] = await Promise.all([
    supabase
      .from("customer_payments")
      .select("id, entry_date, type, amount, currency, note, order_id")
      .eq("customer_id", id)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_date, seasons(name)")
      .eq("customer_id", id)
      .order("order_date", { ascending: false }),
  ]);

  // Build order lookup map for display
  const orderMap = new Map(
    (orders ?? []).map((o) => [
      o.id,
      `${o.order_date ?? ""} ${((o.seasons as { name: string } | null)?.name ?? "")}`.trim(),
    ])
  );

  // Running totals
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries ?? []) {
    if (e.type === "debit")  totalDebit  += Number(e.amount);
    if (e.type === "credit") totalCredit += Number(e.amount);
  }
  const balance = totalDebit - totalCredit;

  function fmt(amount: number, currency: string) {
    const sym = currency === "EUR" ? "€" : "¥";
    return `${sym}${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="space-y-4">
      {/* Header: add entry + summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <CustomerPaymentNew customerId={id} orders={(orders ?? []) as any} />
        <div className="flex gap-6 text-sm">
          <span className="text-gray-500">
            Total Debit: <span className="font-semibold text-orange-700">{fmt(totalDebit, "EUR")}</span>
          </span>
          <span className="text-gray-500">
            Total Credit: <span className="font-semibold text-green-700">{fmt(totalCredit, "EUR")}</span>
          </span>
          <span className={`font-semibold ${balance > 0 ? "text-orange-600" : "text-green-700"}`}>
            Balance: {balance < 0 ? "-" : ""}{fmt(Math.abs(balance), "EUR")}
          </span>
        </div>
      </div>

      {/* Ledger table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {!(entries ?? []).length ? (
          <p className="px-5 py-8 text-sm text-gray-400">支払い履歴がありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Date</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Type</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Note</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Order</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Debit</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 text-xs">Credit</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700 text-xs">{e.entry_date}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.type === "debit"
                        ? "bg-orange-50 text-orange-700"
                        : "bg-green-50 text-green-700"
                    }`}>
                      {e.type === "debit" ? "Debit" : "Credit"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.note ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {e.order_id ? (orderMap.get(e.order_id) ?? e.order_id.slice(0, 8)) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {e.type === "debit"
                      ? <span className="text-orange-700 font-medium">{fmt(Number(e.amount), e.currency)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {e.type === "credit"
                      ? <span className="text-green-700 font-medium">{fmt(Number(e.amount), e.currency)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <CustomerPaymentDelete entryId={e.id} customerId={id} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-600">Total</td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-orange-700">{fmt(totalDebit, "EUR")}</td>
                <td className="px-4 py-2 text-right text-xs font-semibold text-green-700">{fmt(totalCredit, "EUR")}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
