"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcCustomerWholesaleEur } from "@/lib/pricing";
import { SIZES } from "@/lib/order-constants";

export async function addProductToOrder(orderId: string, productId: string): Promise<string | null> {
  const supabase = await createClient();

  const [productResult, orderResult] = await Promise.all([
    supabase.from("products").select("wholesale_eur, retail_price_eur").eq("id", productId).single(),
    supabase.from("orders").select("discount_rate").eq("id", orderId).single(),
  ]);

  const product: any = productResult.data;
  const order: any = orderResult.data;

  if (!product || !order) return "Product or order not found";

  const wholesale_price_eur = Number(product.wholesale_eur);
  const retail_price_eur = Number(product.retail_price_eur);
  const customer_wholesale_eur = calcCustomerWholesaleEur(retail_price_eur, Number(order.discount_rate));

  const { data: item, error } = await supabase
    .from("order_items")
    .insert({ order_id: orderId, product_id: productId, wholesale_price_eur, retail_price_eur, customer_wholesale_eur })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return "This product has already been added to the order";
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
