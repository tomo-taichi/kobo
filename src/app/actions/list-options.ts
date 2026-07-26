"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ADR-0009 Phase 3 (Settings) — manage a domain's select-list options.

export async function addListOption(domain: string, value: string): Promise<string | null> {
  const v = value.trim();
  if (!v) return "Value is required";
  const supabase = await createClient();

  // Append to the end of the domain's current order.
  const { data: last } = await supabase
    .from("list_options")
    .select("sort_order")
    .eq("domain", domain)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last?.sort_order as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("list_options").insert({ domain, value: v, sort_order: nextOrder });
  if (error) {
    if (error.code === "23505") return "That value already exists in this list";
    return error.message;
  }
  revalidatePath("/settings");
  return null;
}

export async function deleteListOption(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("list_options").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath("/settings");
  return null;
}
