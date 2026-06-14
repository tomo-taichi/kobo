"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(formData: FormData, key: string) {
  return (formData.get(key) as string)?.trim() || null;
}

function extractFields(formData: FormData) {
  const shippingSame = formData.get("shipping_same") === "true";

  let shops: { name: string; address: string }[] = [];
  try { shops = JSON.parse((formData.get("shops") as string) || "[]"); } catch {}

  let sns: { platform: string; url: string }[] = [];
  try { sns = JSON.parse((formData.get("sns") as string) || "[]"); } catch {}

  return {
    name:             str(formData, "name"),
    group_type:       str(formData, "group_type"),
    deposit_terms:    str(formData, "deposit_terms") ?? "Deposit_and_Production",
    currency:         str(formData, "currency") ?? "JPY",
    tax_included:     formData.get("tax_included") === "true",
    bank:             str(formData, "bank"),
    contract_status:     str(formData, "contract_status") ?? "Active",
    contract_start_date: str(formData, "contract_start_date"),
    contract_end_date:   str(formData, "contract_end_date"),
    website:          str(formData, "website"),
    sns,
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
    // shipping
    shipping_same:    shippingSame,
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
  if (!fields.group_type) return "Customer group is required";
  const { error } = await supabase.from("customers").insert(fields);
  if (error) return error.message;
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomerStatus(
  id: string,
  contractStatus: string
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("customers").update({ contract_status: contractStatus }).eq("id", id);
  revalidatePath("/customers");
}

export async function updateCustomer(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const fields = extractFields(formData);
  if (!fields.name)       return "Client name is required";
  if (!fields.group_type) return "Customer group is required";
  const { error } = await supabase.from("customers").update(fields).eq("id", id);
  if (error) return error.message;
  revalidatePath("/customers");
  redirect(`/customers/${id}/info`);
}
