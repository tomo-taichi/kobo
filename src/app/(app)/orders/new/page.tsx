import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/components/order-form";
import { createOrder } from "@/app/actions/orders";

export default async function NewOrderPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];

  const [customersResult, seasonsResult] = await Promise.all([
    supabase.from("customers").select("id, name, currency").order("name"),
    supabase.from("seasons").select("id, name, eur_jpy_rate").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">New Order</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <OrderForm
          action={createOrder}
          customers={(customersResult.data ?? []) as any}
          seasons={(seasonsResult.data ?? []) as any}
          defaultOrderDate={today}
        />
      </div>
    </div>
  );
}
