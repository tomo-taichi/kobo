import type { SupabaseClient } from "@supabase/supabase-js";
import { getMaterialRoleLabels, materialRoleLabel } from "@/lib/material-roles";

// ADR-0009 Phase 2 — per-season material usage breakdown.
// For each Material×Color, the list of order lines that consume it (which order,
// which product, in which role, how much per unit × how many units). Powers both
// the "Detail" popup on the Material Order page and the printable aggregation sheet.

export type UsageLine = {
  orderId: string;
  orderNumber: string | null;
  orderDate: string | null;
  customerName: string | null;
  productNumber: string | null; // P.ID
  modelName: string;
  productCategory: string | null;
  role: string; // "Main" | "Lining" | material_group label
  perUnitUsage: number;
  sizes: { size: string; qty: number }[];
  units: number;
  lineTotal: number;
};

export type UsageGroup = {
  materialColorId: string;
  materialId: string | null;
  materialNumber: string | null; // M.ID
  materialName: string;
  materialCategory: string | null;
  colour: string;
  unitType: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierPerson: string | null;
  totalUsage: number;
  lines: UsageLine[];
};

export async function buildMaterialUsage(supabase: SupabaseClient, seasonId: string): Promise<UsageGroup[]> {
  const orderItemsRes = await supabase
    .from("order_items")
    .select(
      "id, order_id, product_id, product_colors(material_color_id), order_item_sizes(size, quantity), orders!inner(id, order_number, order_date, season_id, customers(name))"
    )
    .eq("orders.season_id", seasonId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderItems = (orderItemsRes.data ?? []) as any[];
  if (orderItems.length === 0) return [];

  const productIds = Array.from(new Set(orderItems.map((it) => it.product_id)));

  const [productsRes, pmRes, mcRes, roleLabels] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, product_number, model_name, name, product_category, main_material_id, main_m_quantity, lining_material_id, lining_m_quantity, lining_material_color_id"
      )
      .in("id", productIds),
    supabase
      .from("product_materials")
      .select("product_id, material_group, usage_amount, material_color_id")
      .in("product_id", productIds),
    supabase
      .from("material_colors")
      .select(
        "id, color, materials(id, material_number, name, category, unit_type, supplier_id, suppliers(id, name, primary_email, primary_name))"
      ),
    getMaterialRoleLabels(supabase),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pmsByProduct = new Map<string, any[]>();
  for (const pm of pmRes.data ?? []) {
    const arr = pmsByProduct.get(pm.product_id) ?? [];
    arr.push(pm);
    pmsByProduct.set(pm.product_id, arr);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcMap = new Map((mcRes.data ?? []).map((mc: any) => [mc.id, mc]));

  const groupsByMc = new Map<string, UsageGroup>();
  const ensureGroup = (mcId: string): UsageGroup | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mc: any = mcMap.get(mcId);
    if (!mc || !mc.materials) return null;
    let g = groupsByMc.get(mcId);
    if (!g) {
      const mat = mc.materials;
      const sup = mat.suppliers;
      g = {
        materialColorId: mcId,
        materialId: mat.id ?? null,
        materialNumber: mat.material_number != null ? String(mat.material_number) : null,
        materialName: mat.name ?? "—",
        materialCategory: mat.category ?? null,
        colour: mc.color ?? "—",
        unitType: mat.unit_type ?? "",
        supplierId: mat.supplier_id ?? null,
        supplierName: sup?.name ?? null,
        supplierEmail: sup?.primary_email ?? null,
        supplierPerson: sup?.primary_name ?? null,
        totalUsage: 0,
        lines: [],
      };
      groupsByMc.set(mcId, g);
    }
    return g;
  };

  const addLine = (
    mcId: string | null | undefined,
    perUnit: number,
    role: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: any
  ) => {
    if (!mcId || !perUnit) return;
    const g = ensureGroup(mcId);
    if (!g) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sizes = ((it.order_item_sizes ?? []) as any[])
      .filter((s) => (s.quantity ?? 0) > 0)
      .map((s) => ({ size: String(s.size), qty: Number(s.quantity ?? 0) }));
    const units = sizes.reduce((a, b) => a + b.qty, 0);
    if (units <= 0) return;
    const lineTotal = perUnit * units;
    const ord = it.orders;
    g.lines.push({
      orderId: it.order_id,
      orderNumber: ord?.order_number != null ? String(ord.order_number) : null,
      orderDate: ord?.order_date ?? null,
      customerName: ord?.customers?.name ?? null,
      productNumber: p.product_number != null ? String(p.product_number) : null,
      modelName: p.model_name || p.name || "—",
      productCategory: p.product_category ?? null,
      role,
      perUnitUsage: perUnit,
      sizes,
      units,
      lineTotal,
    });
    g.totalUsage += lineTotal;
  };

  for (const it of orderItems) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = productsMap.get(it.product_id);
    if (!p) continue;
    const mainColor = it.product_colors?.material_color_id as string | undefined;
    if (p.main_material_id) addLine(mainColor, Number(p.main_m_quantity ?? 0), materialRoleLabel("main", roleLabels), it, p);
    if (p.lining_material_id) addLine(p.lining_material_color_id, Number(p.lining_m_quantity ?? 0), materialRoleLabel("lining", roleLabels), it, p);
    for (const pm of pmsByProduct.get(it.product_id) ?? []) {
      const label = materialRoleLabel(pm.material_group, roleLabels);
      addLine(pm.material_color_id, Number(pm.usage_amount ?? 0), label, it, p);
    }
  }

  const groups = Array.from(groupsByMc.values());
  for (const g of groups) {
    g.lines.sort(
      (a, b) =>
        (a.productNumber ?? "").localeCompare(b.productNumber ?? "") ||
        (a.orderNumber ?? "").localeCompare(b.orderNumber ?? "")
    );
  }
  groups.sort(
    (a, b) =>
      (a.supplierName ?? "~").localeCompare(b.supplierName ?? "~", "ja") ||
      a.materialName.localeCompare(b.materialName, "ja") ||
      a.colour.localeCompare(b.colour)
  );
  return groups;
}
