"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcCustomerWholesaleEur } from "@/lib/pricing";
import { SIZES } from "@/lib/order-constants";

// Add one order line = a product in a specific colour (product_colors). Price is
// snapshotted from that colour's stack.
export async function addProductColorToOrder(orderId: string, productColorId: string): Promise<string | null> {
  const supabase = await createClient();

  const [pcResult, orderResult] = await Promise.all([
    supabase.from("product_colors").select("product_id, wholesale_eur, retail_price_eur").eq("id", productColorId).single(),
    supabase.from("orders").select("discount_rate").eq("id", orderId).single(),
  ]);

  const pc: any = pcResult.data;
  const order: any = orderResult.data;

  if (!pc || !order) return "Product colour or order not found";

  const wholesale_price_eur = Number(pc.wholesale_eur);
  const retail_price_eur = Number(pc.retail_price_eur);
  const customer_wholesale_eur = calcCustomerWholesaleEur(retail_price_eur, Number(order.discount_rate));

  const { data: item, error } = await supabase
    .from("order_items")
    .insert({ order_id: orderId, product_id: pc.product_id, product_color_id: productColorId, wholesale_price_eur, retail_price_eur, customer_wholesale_eur })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return "This product colour is already in the order";
    return error.message;
  }

  const orderItemId = (item as { id: string }).id;
  await supabase.from("order_item_sizes").insert(
    SIZES.map((size) => ({ order_item_id: orderItemId, size, quantity: 0 }))
  );

  revalidatePath(`/orders/${orderId}`);
  return null;
}

export async function removeOrderItem(orderId: string, orderItemId: string) {
  const supabase = await createClient();
  await supabase.from("order_items").delete().eq("id", orderItemId);
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderItemSizes(
  orderId: string,
  orderItemId: string,
  sizes: { size: string; quantity: number }[]
): Promise<string | null> {
  const supabase = await createClient();
  for (const { size, quantity } of sizes) {
    const { error } = await supabase
      .from("order_item_sizes")
      .upsert({ order_item_id: orderItemId, size, quantity }, { onConflict: "order_item_id,size" });
    if (error) return error.message;
  }
  revalidatePath(`/orders/${orderId}`);
  return null;
}
