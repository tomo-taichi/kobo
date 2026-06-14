"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function extractFields(formData: FormData) {
  const country = (formData.get("country") as string)?.trim() || null;
  return {
    name: (formData.get("name") as string)?.trim(),
    country: country === "__custom__" ? null : country,
    address: (formData.get("address") as string)?.trim() || null,
    company_phone: (formData.get("company_phone") as string)?.trim() || null,
    primary_name: (formData.get("primary_name") as string)?.trim() || null,
    primary_title: (formData.get("primary_title") as string)?.trim() || null,
    primary_mobile: (formData.get("primary_mobile") as string)?.trim() || null,
    primary_email: (formData.get("primary_email") as string)?.trim() || null,
    secondary_name: (formData.get("secondary_name") as string)?.trim() || null,
    secondary_title: (formData.get("secondary_title") as string)?.trim() || null,
    secondary_mobile: (formData.get("secondary_mobile") as string)?.trim() || null,
    secondary_email: (formData.get("secondary_email") as string)?.trim() || null,
    notes: (formData.get("notes") as string)?.trim() || null,
  };
}

export async function createSupplier(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const fields = extractFields(formData);
  if (!fields.name) return "仕入先名を入力してください";
  const { error } = await supabase.from("suppliers").insert(fields);
  if (error) return error.message;
  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplier(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const fields = extractFields(formData);
  if (!fields.name) return "仕入先名を入力してください";
  const { error } = await supabase.from("suppliers").update(fields).eq("id", id);
  if (error) return error.message;
  revalidatePath("/suppliers");
  redirect("/suppliers");
}
