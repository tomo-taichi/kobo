import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0009 Phase 3 (Settings) — managed select-lists.
// Every user-editable dropdown is a "domain" of options in the list_options table.
// The Settings screen groups these domains; forms and the Kanban read from them.

export type ListOption = { id: string; value: string; label: string | null; sortOrder: number; active: boolean };

// Domains grouped the way the Settings screen presents them. Only the domains that
// are actually wired to a live consumer are marked ready; the rest are placeholders
// surfaced in the UI so the roadmap is visible.
export const SETTINGS_GROUPS = [
  {
    key: "production",
    label: "Production",
    domains: [
      { domain: "cutter", label: "Cutters", ready: true },
      { domain: "sewer", label: "Sewers", ready: true },
    ],
  },
  {
    key: "supplier",
    label: "Suppliers",
    domains: [{ domain: "supplier_country", label: "Country", ready: false }],
  },
  {
    key: "materials",
    label: "Materials",
    domains: [
      { domain: "material_category", label: "Category", ready: false },
      { domain: "material_unit", label: "Unit", ready: false },
      { domain: "material_composition", label: "Composition", ready: false },
    ],
  },
  {
    key: "products",
    label: "Products",
    domains: [
      { domain: "product_category", label: "Category", ready: false },
      { domain: "product_sex", label: "Sex", ready: false },
      { domain: "product_accessory_composition", label: "Accessory Composition", ready: false },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    domains: [{ domain: "customer_bank", label: "Bank", ready: false }],
  },
] as const;

// Read one domain's options, ordered. Tolerant: returns [] if the table doesn't
// exist yet (before the migration is applied) so pages don't crash.
export async function getListOptions(supabase: SupabaseClient, domain: string): Promise<ListOption[]> {
  const { data, error } = await supabase
    .from("list_options")
    .select("id, value, label, sort_order, active")
    .eq("domain", domain)
    .order("sort_order", { ascending: true })
    .order("value", { ascending: true });
  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => ({
    id: r.id,
    value: r.value,
    label: r.label ?? null,
    sortOrder: r.sort_order ?? 0,
    active: r.active ?? true,
  }));
}
