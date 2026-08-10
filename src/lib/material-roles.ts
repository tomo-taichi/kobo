import type { SupabaseClient } from "@supabase/supabase-js";
import { getListOptions } from "@/lib/list-options";

// Shared material-role display labels (Japanese defaults), overridable in Settings
// (list_options domain 'material_role'). Used by BOTH the Model Version editor and
// the product material-usage / material-order pages so the vocabulary stays in sync.
export const MATERIAL_ROLE_LABELS: Record<string, string> = {
  // Model Version roles
  lining: "裏地",
  sleeve_lining: "袖裏地",
  pocket_facing: "ポケットスレキ向布",
  pocket_bag: "ポケットスレキ手前布",
  interfacing: "芯地",
  accessories: "付属",
  // Product material_group keys (best-effort JA defaults; refine in Settings)
  main: "メイン",
  body_lining: "身頃裏地",
  pocket_front: "ポケット向布",
  pocket_back: "ポケット手前布",
  interlining: "芯地",
  accessory_parts: "付属パーツ",
  accessory_tag: "付属タグ",
};

// Effective label for a role key: Settings override → JA default → the raw key.
export function materialRoleLabel(key: string, overrides?: Record<string, string>): string {
  return overrides?.[key] || MATERIAL_ROLE_LABELS[key] || key;
}

// Read the Settings overrides for material_role as {value: label}. Empty when the
// domain is unseeded — callers fall back to MATERIAL_ROLE_LABELS.
export async function getMaterialRoleOverrides(supabase: SupabaseClient): Promise<Record<string, string>> {
  const opts = await getListOptions(supabase, "material_role");
  const map: Record<string, string> = {};
  for (const o of opts) if (o.active && o.label) map[o.value] = o.label;
  return map;
}

// The full label map (defaults merged with Settings overrides).
export async function getMaterialRoleLabels(supabase: SupabaseClient): Promise<Record<string, string>> {
  return { ...MATERIAL_ROLE_LABELS, ...(await getMaterialRoleOverrides(supabase)) };
}
