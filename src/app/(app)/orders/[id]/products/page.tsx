import { Fragment } from "react";
import { notFound } from "next/navigation";
import { fmtEur } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SIZES } from "@/lib/order-constants";
import { OrderProductPicker } from "@/components/order-product-picker";
import { OrderSizeGrid } from "@/components/order-size-grid";

// 5 info cols + 11 sizes + 1 subtotal + 1 action
const TOTAL_COLS = 5 + SIZES.length + 2;

export default async function OrderProductsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const orderResult = await supabase
    .from("orders")
    .select("discount_rate")
    .eq("id", id)
    .single();

  if (!orderResult.data) notFound();

  const [itemsResult, allProductsResult, seasonsResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_id, retail_price_eur, customer_wholesale_eur, products(name, product_number, model_name, main_m_name, main_m_color, product_category), order_item_sizes(size, quantity)")
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("products")
      .select("id, product_number, model_name, main_m_name, main_m_color, product_category, product_sex, retail_price_eur, seasons(id, name)")
      .eq("is_invalid", false)
      .order("name"),
    supabase.from("seasons").select("id, name").order("name"),
  ]);

  const items: any[]      = itemsResult.data ?? [];
  const addedIds          = new Set(items.map((i) => i.product_id));
  const availableProducts = (allProductsResult.data ?? []).filter((p: any) => !addedIds.has(p.id));

  // Group by product_category
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const cat = (item.products?.product_category as string | null) ?? "Uncategorized";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }
  const sortedCategories = Array.from(grouped.keys()).sort();

  // Totals from DB values
  let totalQty    = 0;
  let totalRetail = 0;
  for (const item of items) {
    const qty = (item.order_item_sizes ?? []).reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);
    totalQty    += qty;
    totalRetail += qty * Number(item.retail_price_eur ?? 0);
  }

  return (
    <div className="space-y-3">
      {/* Toolbar — includes totals */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-500">
            {items.length} product{items.length !== 1 ? "s" : ""}
          </span>
          {items.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Total</span>
              <span className="text-base font-semibold text-gray-900 font-mono">{totalQty} pcs</span>
              <span className="text-base font-semibold text-gray-900 font-mono">€ {fmtEur(totalRetail)}</span>
            </div>
          )}
        </div>
        <OrderProductPicker
          orderId={id}
          products={availableProducts as any}
          seasons={seasonsResult.data ?? []}
        />
      </div>

      {/* Single table for all categories */}
      {items.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap border-collapse">
              <colgroup>
                <col className="w-24" />   {/* ID */}
                <col className="w-36" />   {/* Model */}
                <col className="w-28" />   {/* Material */}
                <col className="w-24" />   {/* Color */}
                <col className="w-16" />   {/* Retail */}
                {SIZES.map((s) => <col key={s} className="w-9" />)}
                <col className="w-32" />   {/* Qty · Total */}
                <col className="w-10" />   {/* × */}
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-medium text-gray-400">ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-400">Model</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-400">Material</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-400">Color</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Retail</th>
                  {SIZES.map((s) => (
                    <th key={s} className="px-0.5 py-2 text-center font-medium text-gray-400">{s}</th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-gray-400">Qty · Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((cat) => (
                  <Fragment key={cat}>
                    {/* Category separator row */}
                    <tr className="bg-gray-50/80 border-t border-b border-gray-200">
                      <td
                        colSpan={TOTAL_COLS}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-widest"
                      >
                        {cat}
                      </td>
                    </tr>

                    {grouped.get(cat)!.map((item) => {
                      const sizes = (item.order_item_sizes ?? []).map((s: any) => ({
                        size:     s.size,
                        quantity: s.quantity,
                      }));
                      const p = item.products ?? {};
                      return (
                        <OrderSizeGrid
                          key={item.id}
                          orderId={id}
                          orderItemId={item.id}
                          productName={p.name ?? "—"}
                          productNumber={p.product_number ?? null}
                          modelName={p.model_name ?? null}
                          mainMName={p.main_m_name ?? null}
                          mainMColor={p.main_m_color ?? null}
                          retailPriceEur={Number(item.retail_price_eur)}
                          customerWholesaleEur={Number(item.customer_wholesale_eur)}
                          initialSizes={sizes}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-10">
          No products added yet — use the button above to add products
        </p>
      )}
    </div>
  );
}
