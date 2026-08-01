import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0009 Phase 3 (Settings) — customer banks. customers.bank stores bank_key;
// invoices print the matching bank's `details`.
export type Bank = { id: string; bankKey: string; label: string; details: string | null; active: boolean };

const LEGACY_BANK_OPTIONS = [
  { value: "Rakuten_JP", label: "Rakuten JP" },
  { value: "WISE_EU", label: "WISE EU" },
];

export async function getBanks(supabase: SupabaseClient): Promise<Bank[]> {
  const { data, error } = await supabase
    .from("banks")
    .select("id, bank_key, label, details, active")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((b) => ({
    id: b.id,
    bankKey: b.bank_key,
    label: b.label,
    details: b.details ?? null,
    active: b.active ?? true,
  }));
}

// Options for the customer form's bank <select>. Falls back to the legacy two
// banks if the table is empty (before the migration is applied).
export async function getBankOptions(supabase: SupabaseClient): Promise<{ value: string; label: string }[]> {
  const active = (await getBanks(supabase)).filter((b) => b.active).map((b) => ({ value: b.bankKey, label: b.label }));
  return active.length > 0 ? active : LEGACY_BANK_OPTIONS;
}
