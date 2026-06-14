import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/order-constants";

const STATUS_COLOURS: Record<string, string> = {
  A: "bg-gray-100 text-gray-600",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  E: "bg-purple-100 text-purple-700",
  F: "bg-green-100 text-green-700",
};

export default async function CustomerOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_date, status, invoice_type, currency_type, seasons(name)")
    .eq("customer_id", id)
    .order("order_date", { ascending: false });

  if (orders === null) notFound();

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Order History — {orders.length} order{orders.length !== 1 ? "s" : ""}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-400">No orders yet</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Order Date</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Season</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Status</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Invoice Type</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 text-xs">Currency</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o: any) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700 text-xs">{o.order_date ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {(o.seasons as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOURS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {INVOICE_TYPE_LABELS[o.invoice_type] ?? o.invoice_type}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{o.currency_type}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/orders/${o.id}/info`}
                    className="text-gray-400 hover:text-gray-900 text-xs underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
