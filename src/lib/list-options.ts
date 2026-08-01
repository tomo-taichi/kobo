import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_CATEGORIES, PRODUCT_SEXES, ACCESSORY_COMPOSITIONS } from "@/lib/product-constants";
import {
  FABRIC_CATEGORIES,
  ACCESSORY_CATEGORIES,
  UNIT_TYPES,
  CATEGORY_LABELS,
  UNIT_TYPE_LABELS,
  COMPOSITION_GROUPS,
} from "@/lib/material-constants";

// Countries offered on the supplier form before the list was managed here.
export const DEFAULT_SUPPLIER_COUNTRIES = ["Japan", "Italy", "China", "USA", "UK"];

export type LabeledValue = { value: string; label: string };
export type SettingsDomain = { domain: string; label: string; ready: boolean; withLabel?: boolean };
export type SettingsGroup = { key: string; label: string; domains: SettingsDomain[] };

// ADR-0009 Phase 3 (Settings) — managed select-lists.
// Every user-editable dropdown is a "domain" of options in the list_options table.
// The Settings screen groups these domains; forms and the Kanban read from them.

export type ListOption = { id: string; value: string; label: string | null; sortOrder: number; active: boolean };

// Domains grouped the way the Settings screen presents them. Only the domains that
// are actually wired to a live consumer are marked ready; the rest are placeholders
// surfaced in the UI so the roadmap is visible.
export const SETTINGS_GROUPS: SettingsGroup[] = [
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
    domains: [{ domain: "supplier_country", label: "Country", ready: true }],
  },
  {
    key: "materials",
    label: "Materials",
    domains: [
      { domain: "material_category_fabric", label: "Fabric Category", ready: true, withLabel: true },
      { domain: "material_category_accessory", label: "Accessory Category", ready: true, withLabel: true },
      { domain: "material_unit", label: "Unit", ready: true, withLabel: true },
      { domain: "material_composition", label: "Composition", ready: true },
    ],
  },
  {
    key: "products",
    label: "Products",
    domains: [
      { domain: "product_category", label: "Category", ready: true },
      { domain: "product_sex", label: "Sex", ready: true },
      { domain: "product_accessory_composition", label: "Accessory Composition", ready: true },
    ],
  },
  // Customers → Banks is not a simple list; it has its own section (BanksManager).
];

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

// Active values for a domain, or the given fallback when the domain has no rows
// yet (before the seed migration). Used to feed form <select> dropdowns.
export async function getListValues(
  supabase: SupabaseClient,
  domain: string,
  fallback: readonly string[]
): Promise<string[]> {
  const opts = (await getListOptions(supabase, domain)).filter((o) => o.active);
  return opts.length > 0 ? opts.map((o) => o.value) : [...fallback];
}

// The managed select-lists consumed by the product & supplier forms, fetched together.
export async function getFormOptions(supabase: SupabaseClient): Promise<{
  supplierCountry: string[];
  productCategory: string[];
  productSex: string[];
  productAccessoryComposition: string[];
}> {
  const [supplierCountry, productCategory, productSex, productAccessoryComposition] = await Promise.all([
    getListValues(supabase, "supplier_country", DEFAULT_SUPPLIER_COUNTRIES),
    getListValues(supabase, "product_category", PRODUCT_CATEGORIES),
    getListValues(supabase, "product_sex", PRODUCT_SEXES),
    getListValues(supabase, "product_accessory_composition", ACCESSORY_COMPOSITIONS),
  ]);
  return { supplierCountry, productCategory, productSex, productAccessoryComposition };
}

// Active {value,label} pairs for a domain, or the fallback when it has no rows.
export async function getLabeledValues(
  supabase: SupabaseClient,
  domain: string,
  fallback: LabeledValue[]
): Promise<LabeledValue[]> {
  const opts = (await getListOptions(supabase, domain)).filter((o) => o.active);
  return opts.length > 0 ? opts.map((o) => ({ value: o.value, label: o.label ?? o.value })) : fallback;
}

// Managed lists consumed by the material form. Categories keep their fabric /
// accessory split (two domains → two optgroups); units carry a display label;
// compositions are a flat list. All fall back to the previous hard-coded values.
export type MaterialFormOptions = {
  fabricCategories: LabeledValue[];
  accessoryCategories: LabeledValue[];
  units: LabeledValue[];
  compositions: string[];
};

export async function getMaterialFormOptions(supabase: SupabaseClient): Promise<MaterialFormOptions> {
  const compositionFallback = COMPOSITION_GROUPS.flatMap((g) => g.items);
  const [fabricCategories, accessoryCategories, units, compositions] = await Promise.all([
    getLabeledValues(supabase, "material_category_fabric", FABRIC_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))),
    getLabeledValues(supabase, "material_category_accessory", ACCESSORY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c }))),
    getLabeledValues(supabase, "material_unit", UNIT_TYPES.map((u) => ({ value: u, label: UNIT_TYPE_LABELS[u] ?? u }))),
    getListValues(supabase, "material_composition", compositionFallback),
  ]);
  return { fabricCategories, accessoryCategories, units, compositions };
}
