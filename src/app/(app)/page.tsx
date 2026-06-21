import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/order-constants";

const STATUS_COLORS: Record<string, string> = {
  A: "bg-gray-100 text-gray-600",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  E: "bg-purple-100 text-purple-700",
};

const STATUS_URGENCY: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

export default async function HomePage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, order_date, invoice_type, customers(id, name), seasons(name)")
    .in("status", ["A", "B", "C", "D", "E"])
    .order("created_at", { ascending: false });

  // Group by customer
  type OrderRow = {
    id: string;
    status: string;
    order_date: string | null;
    invoice_type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customers: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seasons: any;
  };

  const grouped = new Map<string, { customerName: string; orders: OrderRow[] }>();
  for (const order of (orders ?? []) as OrderRow[]) {
    const customerId = order.customers?.id ?? "unknown";
    const customerName = order.customers?.name ?? "—";
    if (!grouped.has(customerId)) {
      grouped.set(customerId, { customerName, orders: [] });
    }
    grouped.get(customerId)!.orders.push(order);
  }

  // Sort within each customer group by urgency (A first)
  for (const group of grouped.values()) {
    group.orders.sort((a, b) => (STATUS_URGENCY[a.status] ?? 9) - (STATUS_URGENCY[b.status] ?? 9));
  }

  // Sort customers by name
  const sortedGroups = Array.from(grouped.entries()).sort(([, a], [, b]) =>
    a.customerName.localeCompare(b.customerName, "ja")
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400">Open Orders (excluding F)</p>
      </div>

      {sortedGroups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm">No open orders</p>
          <Link href="/orders/new" className="mt-4 inline-block text-sm text-gray-900 underline">
            Create New Order
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([customerId, group]) => (
            <div key={customerId} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                <h2 className="font-medium text-gray-800 text-sm">{group.customerName}</h2>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {group.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {order.seasons?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{order.invoice_type}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{order.order_date ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/orders/${order.id}`}
                          className="text-gray-500 hover:text-gray-900 text-xs underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
