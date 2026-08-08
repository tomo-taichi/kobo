"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBankOptions } from "@/lib/banks";

function str(formData: FormData, key: string) {
  return (formData.get(key) as string)?.trim() || null;
}

// Percent field (0–100) → fraction (0–1), clamped.
function pctFraction(formData: FormData, key: string): number {
  const n = Number(formData.get(key));
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n)) / 100;
}

function extractFields(formData: FormData) {
  const shippingSame = formData.get("shipping_same") === "true";

  let shops: { name: string; address: string }[] = [];
  try { shops = JSON.parse((formData.get("shops") as string) || "[]"); } catch {}

  let sns: { platform: string; url: string }[] = [];
  try { sns = JSON.parse((formData.get("sns") as string) || "[]"); } catch {}

  let contacts: { name: string; jobTitle: string; email: string; mobile: string; phone: string }[] = [];
  try { contacts = JSON.parse((formData.get("contacts") as string) || "[]"); } catch {}

  const customer_type = str(formData, "customer_type");
  const currency      = str(formData, "currency") ?? "JPY";

  return {
    name:             str(formData, "name"),
    customer_type,
    language:         str(formData, "language") ?? "en",
    is_vip:           formData.get("is_vip") === "true",
    default_discount_rate: pctFraction(formData, "default_discount_pct"),
    default_deposit_rate:  pctFraction(formData, "default_deposit_pct"),
    portal_access:    formData.get("portal_access") === "true",
    deposit_terms:    str(formData, "deposit_terms") ?? "Deposit_and_Production",
    currency,
    tax_included:     formData.get("tax_included") === "true",
    bank:             str(formData, "bank"),
    contract_status:     str(formData, "contract_status") ?? "Active",
    contract_start_date: str(formData, "contract_start_date"),
    contract_end_date:   str(formData, "contract_end_date"),
    website:          str(formData, "website"),
    payment_terms:    str(formData, "payment_terms"),
    shipping_terms:   str(formData, "shipping_terms"),
    sns,
    contacts,
    // billing
    billing_company:  str(formData, "billing_company"),
    billing_address:  str(formData, "billing_address"),
    billing_city:     str(formData, "billing_city"),
    billing_state:    str(formData, "billing_state"),
    billing_postcode: str(formData, "billing_postcode"),
    billing_country:  str(formData, "billing_country"),
    billing_tel:      str(formData, "billing_tel"),
    billing_email:    str(formData, "billing_email"),
    billing_vat:      str(formData, "billing_vat"),
    billing_fax:      str(formData, "billing_fax"),
    // shipping
    shipping_same:    shippingSame,
    shipping_fax:     shippingSame ? str(formData, "billing_fax")      : str(formData, "shipping_fax"),
    shipping_name:    shippingSame ? str(formData, "billing_company") : str(formData, "shipping_name"),
    shipping_address: shippingSame ? str(formData, "billing_address") : str(formData, "shipping_address"),
    shipping_city:    shippingSame ? str(formData, "billing_city")    : str(formData, "shipping_city"),
    shipping_state:   shippingSame ? str(formData, "billing_state")   : str(formData, "shipping_state"),
    shipping_postcode:shippingSame ? str(formData, "billing_postcode"): str(formData, "shipping_postcode"),
    shipping_country: shippingSame ? str(formData, "billing_country") : str(formData, "shipping_country"),
    shipping_tel:     shippingSame ? str(formData, "billing_tel")     : str(formData, "shipping_tel"),
    shipping_email:   shippingSame ? str(formData, "billing_email")   : str(formData, "shipping_email"),
    shipping_vat:     shippingSame ? str(formData, "billing_vat")     : str(formData, "shipping_vat"),
    shipping_memo:    str(formData, "shipping_memo"),
    forwarder:        str(formData, "forwarder"),
    forwarder_account:str(formData, "forwarder_account"),
    shops,
  };
}

export async function createCustomer(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const fields = extractFields(formData);
  if (!fields.name)       return "Client name is required";
  if (!fields.customer_type) return "Customer type is required";
  const { error } = await supabase.from("customers").insert(fields);
  if (error) return error.message;
  revalidatePath("/customers");
  redirect("/customers");
}

// Delete one or more customers. Blocked by the DB if any has orders (FK
// no-action) — surfaced as a friendly message. Contracts/payments cascade;
// portal users' customer_id is set null.
export async function deleteCustomers(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().in("id", ids);
  if (error) {
    if (error.code === "23503") {
      return "Some selected customers have orders and can't be deleted. Remove or reassign their orders first.";
    }
    return error.message;
  }
  revalidatePath("/customers");
  return null;
}

export async function updateCustomerStatus(
  id: string,
  contractStatus: string
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("customers").update({ contract_status: contractStatus }).eq("id", id);
  revalidatePath("/customers");
}

// Set the same contract status on many customers at once (bulk action).
export async function bulkUpdateCustomerStatus(
  ids: string[],
  contractStatus: string
): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ contract_status: contractStatus }).in("id", ids);
  if (error) return error.message;
  revalidatePath("/customers");
  return null;
}

export async function updateCustomer(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const fields = extractFields(formData);
  if (!fields.name)       return "Client name is required";
  if (!fields.customer_type) return "Customer type is required";
  const { error } = await supabase.from("customers").update(fields).eq("id", id);
  if (error) return error.message;
  // Only revalidate the list; do NOT revalidate the current /info route — refreshing
  // the page the user is actively editing can reset the form mid-edit. /info is
  // dynamic and re-fetches fresh on the next visit anyway.
  revalidatePath("/customers");
  return "ok"; // auto-save: stay on the page (no redirect)
}

// ─── Data fetchers for the Customers list popups ──────────────────────
export async function getCustomerFull(id: string): Promise<{ customer: any; bankOptions: { value: string; label: string }[] } | null> {
  const supabase = await createClient();
  const [{ data: c }, bankOptions] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    getBankOptions(supabase),
  ]);
  if (!c) return null;
  return { customer: c, bankOptions };
}

export async function getCustomerOrders(id: string): Promise<any[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, order_date, status, invoice_type, currency_type, seasons(name)")
    .eq("customer_id", id)
    .order("order_date", { ascending: false });
  return data ?? [];
}

export async function getCustomerPayments(id: string): Promise<{ entries: any[]; totalDebit: number; totalCredit: number }> {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("customer_payments")
    .select("id, entry_date, type, amount, currency, note")
    .eq("customer_id", id)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  let totalDebit = 0, totalCredit = 0;
  for (const e of entries ?? []) {
    if (e.type === "debit") totalDebit += Number(e.amount);
    if (e.type === "credit") totalCredit += Number(e.amount);
  }
  return { entries: entries ?? [], totalDebit, totalCredit };
}

export async function getCustomerUsers(customerId: string) {
  const { listCustomerUsers } = await import("@/lib/users");
  return listCustomerUsers(customerId);
}
