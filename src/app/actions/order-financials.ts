"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcCustomerWholesaleEur } from "@/lib/pricing";

export async function saveOrderFinancials(
  orderId: string,
  discountRate: number,
  depositRate: number,
  exchangeRate: number | null,
  taxRate: number
): Promise<string | null> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("order_items")
    .select("id, retail_price_eur, order_item_sizes(quantity)")
    .eq("order_id", orderId);

  if (!items) return "Failed to fetch order items";

  for (const item of items) {
    const retail = Number((item as any).retail_price_eur);
    const customerWs = calcCustomerWholesaleEur(retail, discountRate);
    await supabase
      .from("order_items")
      .update({ customer_wholesale_eur: customerWs })
      .eq("id", item.id);
  }

  // Calculate totalWithTax — the base for deposit
  let subtotalCustomerEur = 0;
  for (const item of items) {
    const retail   = Number((item as any).retail_price_eur);
    const totalQty = ((item as any).order_item_sizes ?? []).reduce(
      (s: number, sz: { quantity: number }) => s + sz.quantity, 0
    );
    subtotalCustomerEur += calcCustomerWholesaleEur(retail, discountRate) * totalQty;
  }
  const totalWithTax = subtotalCustomerEur * (1 + taxRate);
  const depositAmountEur = totalWithTax * depositRate;

  // JPY — convert the wholesale subtotal first (floor 1,000), tax & total in JPY,
  // then the deposit as a floored share of the JPY total (matches OC / invoices).
  const subtotalCustomerJpy = exchangeRate ? Math.floor(subtotalCustomerEur * exchangeRate / 1000) * 1000 : null;
  const taxAmountJpy = subtotalCustomerJpy !== null ? Math.floor(subtotalCustomerJpy * taxRate / 1000) * 1000 : null;
  const totalWithTaxJpy = subtotalCustomerJpy !== null ? subtotalCustomerJpy + (taxAmountJpy ?? 0) : null;
  const depositAmountJpy = totalWithTaxJpy !== null
    ? Math.floor(totalWithTaxJpy * depositRate / 1000) * 1000
    : null;

  const { error } = await supabase.from("orders").update({
    discount_rate:     discountRate,
    deposit_rate:      depositRate,
    deposit_amount_eur: depositAmountEur,
    deposit_amount_jpy: depositAmountJpy,
    exchange_rate:     exchangeRate,
    tax_rate:          taxRate,
  }).eq("id", orderId);

  if (error) return error.message;
  revalidatePath(`/orders/${orderId}`);
  return null;
}

export async function toggleOrderItemFlag(
  orderId: string,
  itemId: string,
  field: "is_flagged_invoice" | "is_flagged_delivery",
  value: boolean
) {
  const supabase = await createClient();
  await supabase.from("order_items").update({ [field]: value }).eq("id", itemId);
  revalidatePath(`/orders/${orderId}`);
}

export async function incrementInvoiceCount(orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("invoice_count").eq("id", orderId).single();
  const current = Number((data as any)?.invoice_count ?? 0);
  await supabase.from("orders").update({ invoice_count: current + 1 }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
}
