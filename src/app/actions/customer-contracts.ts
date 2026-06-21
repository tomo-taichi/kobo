"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function uploadCustomerContract(
  customerId: string,
  formData: FormData
): Promise<string | null> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return "Please select a file";

  const supabase = await createClient();
  const path = `${customerId}/${Date.now()}_${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("contracts")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream" });

  if (uploadError) return uploadError.message;

  const { error: dbError } = await supabase
    .from("customer_contracts")
    .insert({ customer_id: customerId, filename: file.name, storage_path: path });

  if (dbError) {
    await supabase.storage.from("contracts").remove([path]);
    return dbError.message;
  }

  revalidatePath(`/customers/${customerId}/edit`);
  return null;
}

export async function deleteCustomerContract(
  contractId: string,
  storagePath: string,
  customerId: string
): Promise<string | null> {
  const supabase = await createClient();

  const { error: storageError } = await supabase.storage
    .from("contracts")
    .remove([storagePath]);

  if (storageError) return storageError.message;

  const { error: dbError } = await supabase
    .from("customer_contracts")
    .delete()
    .eq("id", contractId);

  if (dbError) return dbError.message;

  revalidatePath(`/customers/${customerId}/edit`);
  return null;
}
