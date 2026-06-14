import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/order-form";
import { updateOrder } from "@/app/actions/orders";

export default async function OrderInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  const [orderResult, customersResult, seasonsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, customer_id, season_id, order_date, invoice_type, currency_type, exchange_rate, notes, status")
      .eq("id", id)
      .single(),
    supabase.from("customers").select("id, name, currency").order("name"),
    supabase.from("seasons").select("id, name, eur_jpy_rate").order("name"),
  ]);

  const order: any = orderResult.data;
  if (!order) notFound();

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <OrderForm
          action={updateOrder}
          customers={(customersResult.data ?? []) as any}
          seasons={(seasonsResult.data ?? []) as any}
          defaultOrderDate={today}
          initialData={{
            customer_id:   order.customer_id,
            season_id:     order.season_id,
            order_date:    order.order_date,
            invoice_type:  order.invoice_type,
            currency_type: order.currency_type,
            exchange_rate: order.exchange_rate,
            notes:         order.notes,
          }}
          id={id}
        />
      </div>

    </div>
  );
}
