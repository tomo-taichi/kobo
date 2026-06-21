"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCompositionOption(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Please enter a label";
  const { data: last } = await supabase
    .from("composition_options")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  const sort_order = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("composition_options").insert({ label, sort_order });
  if (error) return error.message;
  revalidatePath("/composition-options");
  redirect("/composition-options");
}

export async function updateCompositionOption(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const label = (formData.get("label") as string)?.trim();
  if (!label) return "Please enter a label";
  const { error } = await supabase.from("composition_options").update({ label }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/composition-options");
  redirect("/composition-options");
}

export async function moveCompositionOptionUp(id: string) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("composition_options")
    .select("id, sort_order")
    .eq("id", id)
    .single();
  if (!current) return;
  const { data: prev } = await supabase
    .from("composition_options")
    .select("id, sort_order")
    .lt("sort_order", current.sort_order)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();
  if (!prev) return;
  await supabase.from("composition_options").update({ sort_order: prev.sort_order }).eq("id", current.id);
  await supabase.from("composition_options").update({ sort_order: current.sort_order }).eq("id", prev.id);
  revalidatePath("/composition-options");
}

export async function moveCompositionOptionDown(id: string) {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("composition_options")
    .select("id, sort_order")
    .eq("id", id)
    .single();
  if (!current) return;
  const { data: next } = await supabase
    .from("composition_options")
    .select("id, sort_order")
    .gt("sort_order", current.sort_order)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();
  if (!next) return;
  await supabase.from("composition_options").update({ sort_order: next.sort_order }).eq("id", current.id);
  await supabase.from("composition_options").update({ sort_order: current.sort_order }).eq("id", next.id);
  revalidatePath("/composition-options");
}
