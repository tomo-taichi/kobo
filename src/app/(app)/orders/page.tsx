import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUSES, STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/order-constants";

const STATUS_COLORS: Record<string, string> = {
  A: "bg-gray-100 text-gray-600",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  E: "bg-purple-100 text-purple-700",
  F: "bg-green-100 text-green-700",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ season_id?: string; customer_id?: string; status?: string }>;
}) {
  const { season_id, customer_id, status } = await searchParams;
  const supabase = await createClient();

  const [seasonsResult, customersResult, ordersResult] = await Promise.all([
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("customers").select("id, name").order("name"),
    (async () => {
      let q = supabase
        .from("orders")
        .select("id, order_date, status, invoice_type, currency_type, customers(name), seasons(name)")
        .order("created_at", { ascending: false });
      if (season_id)   q = q.eq("season_id",   season_id);
      if (customer_id) q = q.eq("customer_id", customer_id);
      if (status)      q = q.eq("status",      status);
      return q;
    })(),
  ]);

  const seasons   = seasonsResult.data   ?? [];
  const customers = customersResult.data ?? [];
  const orders    = ordersResult.data    ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <Link
          href="/orders/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
        >
          + New Order
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-200">
          <form method="get" className="flex gap-2 items-center flex-wrap">
            <select name="season_id" defaultValue={season_id ?? ""}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white">
              <option value="">All seasons</option>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select name="customer_id" defaultValue={customer_id ?? ""}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white">
              <option value="">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select name="status" defaultValue={status ?? ""}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <button type="submit"
              className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200">
              Filter
            </button>
            {(season_id || customer_id || status) && (
              <Link href="/orders" className="text-xs text-gray-500 hover:text-gray-900 underline">Clear</Link>
            )}
          </form>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Season</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Order Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Currency</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">
                  {(o.customers as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {(o.seasons as unknown as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{o.order_date ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{INVOICE_TYPE_LABELS[o.invoice_type] ?? o.invoice_type}</td>
                <td className="px-4 py-3 text-gray-500">{o.currency_type}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/orders/${o.id}/info`}
                    className="text-gray-500 hover:text-gray-900 text-xs underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No orders found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
