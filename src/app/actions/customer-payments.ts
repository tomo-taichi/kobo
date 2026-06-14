"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createPaymentEntry(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const customerId = formData.get("customer_id") as string;
  const amount = parseFloat((formData.get("amount") as string) || "0");
  if (!amount || amount <= 0) return "金額を入力してください";

  const orderId = (formData.get("order_id") as string) || null;
  const category = (formData.get("category") as string) || "other";

  const supabase = await createClient();
  const { error } = await supabase.from("customer_payments").insert({
    customer_id: customerId,
    order_id:    orderId,
    entry_date:  (formData.get("entry_date") as string) || new Date().toISOString().slice(0, 10),
    type:        formData.get("type") as string,
    category:    ["deposit", "balance", "other"].includes(category) ? category : "other",
    amount,
    currency:    (formData.get("currency") as string) || "EUR",
    note:        (formData.get("note") as string)?.trim() || null,
  });
  if (error) return error.message;
  revalidatePath(`/customers/${customerId}/payments`);
  if (orderId) revalidatePath(`/orders/${orderId}/payments`);
  return null;
}

export async function deletePaymentEntry(
  entryId: string,
  customerId: string,
  orderId?: string | null,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("customer_payments").delete().eq("id", entryId);
  revalidatePath(`/customers/${customerId}/payments`);
  if (orderId) revalidatePath(`/orders/${orderId}/payments`);
}
