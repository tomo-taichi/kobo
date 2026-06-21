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
