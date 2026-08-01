"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A stable key derived from the label (customers.bank stores this; kept even if the
// label is later renamed so existing invoices/customers stay valid).
function slugKey(label: string): string {
  return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "BANK";
}

export async function addBank(label: string, details: string): Promise<string | null> {
  const l = label.trim();
  if (!l) return "Bank name is required";

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await supabase.from("banks").select("bank_key, sort_order");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (existing ?? []) as any[];
  const keys = new Set(rows.map((r) => r.bank_key));
  const base = slugKey(l);
  let key = base;
  let i = 2;
  while (keys.has(key)) key = `${base}_${i++}`;
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1) + 1;

  const { error } = await supabase
    .from("banks")
    .insert({ bank_key: key, label: l, details: details.trim() || null, sort_order: nextOrder });
  if (error) return error.message;
  revalidatePath("/settings");
  return null;
}

export async function updateBank(id: string, label: string, details: string): Promise<string | null> {
  const l = label.trim();
  if (!l) return "Bank name is required";
  const supabase = await createClient();
  const { error } = await supabase.from("banks").update({ label: l, details: details.trim() || null }).eq("id", id);
  if (error) return error.message;
  revalidatePath("/settings");
  return null;
}

export async function deleteBank(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("banks").delete().eq("id", id);
  if (error) return error.message;
  revalidatePath("/settings");
  return null;
}
