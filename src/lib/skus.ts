import type { SupabaseClient } from "@supabase/supabase-js";
import { colorSku } from "@/lib/format";

// Per-colour SKU (P000123-01) derived from the product number + the colour's
// 1-based index within the product (ordered by sort_order). Returns a map keyed
// by product_color_id so any colour context can look up its SKU.
export async function buildColorSkuMap(supabase: SupabaseClient, productIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (productIds.length === 0) return out;

  const { data } = await supabase
    .from("product_colors")
    .select("id, product_id, sort_order, products(product_number)")
    .in("product_id", productIds);
  if (!data) return out;

  // Group colours by product, then rank by sort_order for a clean 01, 02, … suffix.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byProduct = new Map<string, { id: string; sort: number; num: string | number | null }[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const pc of data as any[]) {
    const arr = byProduct.get(pc.product_id) ?? [];
    arr.push({ id: pc.id, sort: pc.sort_order ?? 0, num: pc.products?.product_number ?? null });
    byProduct.set(pc.product_id, arr);
  }
  for (const colors of byProduct.values()) {
    colors.sort((a, b) => a.sort - b.sort);
    colors.forEach((c, i) => out.set(c.id, colorSku(c.num, i + 1)));
  }
  return out;
}
