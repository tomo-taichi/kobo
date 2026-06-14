import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch all orders for this customer (with season)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_date, seasons(id, name)")
    .eq("customer_id", id)
    .order("order_date", { ascending: false });

  if (orders === null) notFound();

  const orderIds = orders.map((o) => o.id);

  // Fetch order items with product details
  const { data: items } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("id, order_id, customer_wholesale_eur, products(id, name, product_number, color, model_name)")
        .in("order_id", orderIds)
    : { data: [] };

  // Group items by order, attach season info
  type Item = {
    id: string;
    order_id: string;
    customer_wholesale_eur: number | null;
    products: { id: string; name: string; product_number: string | null; color: string | null; model_name: string | null } | null;
  };

  const orderMap = new Map(orders.map((o) => [o.id, o]));

  // Group by season name then order
  const byOrder: {
    order: (typeof orders)[number];
    items: Item[];
  }[] = orders
    .map((o) => ({
      order: o,
      items: (items ?? []).filter((it) => it.order_id === o.id) as Item[],
    }))
    .filter((g) => g.items.length > 0);

  const totalItems = (items ?? []).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{totalItems} 商品 / {byOrder.length} オーダー</span>
      </div>

      {byOrder.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-5 py-8 text-sm text-gray-400">
          商品オーダー履歴がありません
        </div>
      )}

      {byOrder.map(({ order, items: orderItems }) => {
        const season = (order.seasons as { id: string; name: string } | null);
        return (
          <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-700">
                  {season?.name ?? "—"}
                </span>
                <span className="text-xs text-gray-400">{order.order_date ?? ""}</span>
              </div>
              <Link href={`/orders/${order.id}`} className="text-xs text-gray-400 hover:text-gray-900 underline">
                オーダー詳細 →
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">品番</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Colour</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500 text-xs">Model</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500 text-xs">Unit (EUR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orderItems.map((item) => {
                  const p = item.products;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 text-xs font-mono">{p?.product_number ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-900 text-xs">{p?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{p?.color ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{p?.model_name ?? "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-700 text-xs">
                        {item.customer_wholesale_eur != null
                          ? `€${Number(item.customer_wholesale_eur).toLocaleString("en", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
