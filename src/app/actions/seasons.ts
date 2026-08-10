"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createSeason(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a season name";
  const eur_jpy_rate = formData.get("eur_jpy_rate") ? Number(formData.get("eur_jpy_rate")) : null;
  if (!eur_jpy_rate || eur_jpy_rate <= 0) return "Please enter an exchange rate (JPY/EUR)";

  const { data, error } = await supabase
    .from("seasons")
    .insert({ name, eur_jpy_rate })
    .select("id")
    .single();
  if (error) return error.message;
  revalidatePath("/seasons");
  redirect(`/seasons/${(data as { id: string }).id}`);
}

export async function updateSeason(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return "Please enter a season name";
  const eur_jpy_rate = formData.get("eur_jpy_rate") ? Number(formData.get("eur_jpy_rate")) : null;
  if (!eur_jpy_rate || eur_jpy_rate <= 0) return "Please enter an exchange rate (JPY/EUR)";

  const { error } = await supabase
    .from("seasons")
    .update({ name, eur_jpy_rate })
    .eq("id", id);
  if (error) return error.message;
  revalidatePath("/seasons");
  redirect(`/seasons/${id}`);
}

// ─── Bulk list actions (default list-page spec) ───────────────────────
export async function bulkArchiveSeasons(ids: string[], archived: boolean): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").update({ archived }).in("id", ids);
  if (error) return error.message;
  revalidatePath("/seasons");
  return null;
}

export async function bulkDeleteSeasons(ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const supabase = await createClient();
  const { error } = await supabase.from("seasons").delete().in("id", ids);
  if (error) {
    if (error.code === "23503") return "Some seasons are used by products/materials/orders and can't be deleted. Archive them instead.";
    return error.message;
  }
  revalidatePath("/seasons");
  return null;
}

// Modal edit (no redirect) — update a season's name + rate in place.
export async function updateSeasonFields(id: string, name: string, rate: number, clientDiscount: number): Promise<string | null> {
  const supabase = await createClient();
  const n = name?.trim();
  if (!n) return "Please enter a season name";
  if (!rate || rate <= 0) return "Please enter an exchange rate (JPY/EUR)";
  if (!(clientDiscount >= 0 && clientDiscount < 1)) return "Client discount must be between 0% and 99%";
  const { error } = await supabase.from("seasons").update({ name: n, eur_jpy_rate: rate, client_discount_rate: clientDiscount }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/seasons");
  return null;
}
