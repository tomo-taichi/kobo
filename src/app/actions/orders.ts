"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrder(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const customer_id = formData.get("customer_id") as string;
  const season_id   = formData.get("season_id")   as string;
  if (!customer_id) return "Please select a customer";
  if (!season_id)   return "Please select a season";
  const order_date    = (formData.get("order_date") as string)    || null;
  const invoice_type  =  formData.get("invoice_type")  as string;
  const currency_type =  formData.get("currency_type") as string;
  const exchange_rate = formData.get("exchange_rate") ? Number(formData.get("exchange_rate")) : null;
  const notes         = (formData.get("notes") as string)?.trim() || null;

  const { data, error } = await supabase
    .from("orders")
    .insert({ customer_id, season_id, order_date, invoice_type, currency_type, exchange_rate, notes, discount_rate: 0 })
    .select("id")
    .single();
  if (error) return error.message;
  revalidatePath("/orders");
  redirect(`/orders/${(data as { id: string }).id}/info`);
}

export async function updateOrder(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id          = formData.get("id")          as string;
  const customer_id = formData.get("customer_id") as string;
  const season_id   = formData.get("season_id")   as string;
  if (!customer_id) return "Please select a customer";
  if (!season_id)   return "Please select a season";
  const order_date    = (formData.get("order_date") as string)    || null;
  const invoice_type  =  formData.get("invoice_type")  as string;
  const currency_type =  formData.get("currency_type") as string;
  const exchange_rate = formData.get("exchange_rate") ? Number(formData.get("exchange_rate")) : null;
  const notes         = (formData.get("notes") as string)?.trim() || null;

  // discount_rate is NOT updated here — managed exclusively in Financials tab
  const { error } = await supabase
    .from("orders")
    .update({ customer_id, season_id, order_date, invoice_type, currency_type, exchange_rate, notes })
    .eq("id", id);
  if (error) return error.message;
  revalidatePath(`/orders/${id}`);
  redirect(`/orders/${id}/info`);
}

export async function updateOrderStatus(orderId: string, status: string) {
  const supabase = await createClient();
  await supabase.from("orders").update({ status }).eq("id", orderId);
  revalidatePath(`/orders/${orderId}`);
}
