import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0009 Phase 3 — read-only production rows for a season.
// One row per ProductionBatch unit (Model × Color), aggregated live from the
// ordered quantities. Powers the Production Master List (print) now and the
// Kanban board later. Independent of whether production_batches rows exist yet.

export type ProductionRow = {
  productId: string;
  productColorId: string | null;
  productNumber: string | null; // P.ID
  modelName: string;
  category: string | null;
  sex: string | null;
  colorName: string | null;
  mainMaterialName: string | null;
  orderedQty: number;
  sizes: { size: string; qty: number }[];
};

export async function buildProductionRows(supabase: SupabaseClient, seasonId: string): Promise<ProductionRow[]> {
  const orderItemsRes = await supabase
    .from("order_items")
    .select(
      "product_id, product_color_id, order_item_sizes(size, quantity), product_colors(material_colors(color)), orders!inner(season_id)"
    )
    .eq("orders.season_id", seasonId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderItems = (orderItemsRes.data ?? []) as any[];
  if (orderItems.length === 0) return [];

  const productIds = Array.from(new Set(orderItems.map((it) => it.product_id)));
  const productsRes = await supabase
    .from("products")
    .select("id, product_number, model_name, name, product_category, product_sex, main_m_name")
    .in("id", productIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));

  // Aggregate by (product, colour). sizesMap keeps per-size totals across all orders.
  const rowMap = new Map<string, ProductionRow & { sizesMap: Map<string, number> }>();
  for (const it of orderItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = productsMap.get(it.product_id);
    if (!p) continue;
    const key = `${it.product_id}|${it.product_color_id ?? "none"}`;
    let row = rowMap.get(key);
    if (!row) {
      row = {
        productId: it.product_id,
        productColorId: it.product_color_id ?? null,
        productNumber: p.product_number != null ? String(p.product_number) : null,
        modelName: p.model_name || p.name || "—",
        category: p.product_category ?? null,
        sex: p.product_sex ?? null,
        colorName: it.product_colors?.material_colors?.color ?? null,
        mainMaterialName: p.main_m_name ?? null,
        orderedQty: 0,
        sizes: [],
        sizesMap: new Map<string, number>(),
      };
      rowMap.set(key, row);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (it.order_item_sizes ?? []) as any[]) {
      const q = Number(s.quantity ?? 0);
      if (q <= 0) continue;
      const size = String(s.size);
      row.sizesMap.set(size, (row.sizesMap.get(size) ?? 0) + q);
      row.orderedQty += q;
    }
  }

  const rows = Array.from(rowMap.values()).map((r) => {
    const { sizesMap, ...rest } = r;
    return {
      ...rest,
      sizes: Array.from(sizesMap.entries()).map(([size, qty]) => ({ size, qty })),
    };
  });

  rows.sort(
    (a, b) =>
      a.modelName.localeCompare(b.modelName, "ja") ||
      (a.colorName ?? "").localeCompare(b.colorName ?? "", "ja")
  );
  return rows;
}

// Per-batch order breakdown: which client ordered which sizes / how many.
// Keyed by product_color_id (the batch's colour unit), aggregating every order
// line in the season for that colour, grouped by customer.
export type BatchClientOrder = {
  customerName: string | null;
  sizes: { size: string; qty: number }[];
  units: number;
};

export async function buildBatchOrderDetails(
  supabase: SupabaseClient,
  seasonId: string
): Promise<Map<string, BatchClientOrder[]>> {
  const res = await supabase
    .from("order_items")
    .select("product_color_id, order_item_sizes(size, quantity), orders!inner(season_id, customers(name))")
    .eq("orders.season_id", seasonId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (res.data ?? []) as any[];

  // colourId → customer → (size → qty)
  const byColor = new Map<string, Map<string, Map<string, number>>>();
  for (const it of items) {
    const colourId = it.product_color_id as string | null;
    if (!colourId) continue;
    const customer = it.orders?.customers?.name ?? "—";
    let custMap = byColor.get(colourId);
    if (!custMap) {
      custMap = new Map();
      byColor.set(colourId, custMap);
    }
    let sizeMap = custMap.get(customer);
    if (!sizeMap) {
      sizeMap = new Map();
      custMap.set(customer, sizeMap);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (it.order_item_sizes ?? []) as any[]) {
      const q = Number(s.quantity ?? 0);
      if (q <= 0) continue;
      const size = String(s.size);
      sizeMap.set(size, (sizeMap.get(size) ?? 0) + q);
    }
  }

  const out = new Map<string, BatchClientOrder[]>();
  for (const [colourId, custMap] of byColor) {
    const lines: BatchClientOrder[] = [];
    for (const [customerName, sizeMap] of custMap) {
      const sizes = Array.from(sizeMap.entries()).map(([size, qty]) => ({ size, qty }));
      const units = sizes.reduce((a, b) => a + b.qty, 0);
      if (units > 0) lines.push({ customerName, sizes, units });
    }
    lines.sort((a, b) => (a.customerName ?? "").localeCompare(b.customerName ?? "", "ja"));
    out.set(colourId, lines);
  }
  return out;
}
