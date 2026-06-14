import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderFinancials } from "@/components/order-financials";

export default async function OrderFinancialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const orderResult = await supabase
    .from("orders")
    .select("discount_rate, deposit_rate, customers(tax_included, currency), seasons(eur_jpy_rate)")
    .eq("id", id)
    .single();

  const order: any = orderResult.data;
  if (!order) notFound();

  const itemsResult = await supabase
    .from("order_items")
    .select("id, retail_price_eur, order_item_sizes(quantity)")
    .eq("order_id", id)
    .order("created_at");

  const items = (itemsResult.data ?? []).map((item: any) => ({
    id:             item.id,
    retailPriceEur: Number(item.retail_price_eur),
    totalQty:       (item.order_item_sizes ?? []).reduce((s: number, sz: any) => s + sz.quantity, 0),
  }));

  const isTax      = (order.customers as any)?.tax_included ?? false;
  const taxRate    = isTax ? 0.10 : 0;
  const currency   = (order.customers as any)?.currency === "JPY" ? "JPY" : "EUR";
  const exchangeRate = (order.seasons as any)?.eur_jpy_rate
    ? Number((order.seasons as any).eur_jpy_rate)
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <OrderFinancials
        orderId={id}
        initialDiscountRate={Number(order.discount_rate)}
        initialDepositRate={Number(order.deposit_rate)}
        exchangeRate={exchangeRate}
        taxRate={taxRate}
        isTax={isTax}
        currency={currency}
        items={items}
      />
    </div>
  );
}
