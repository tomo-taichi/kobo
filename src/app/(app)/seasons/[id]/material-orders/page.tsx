import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MaterialOrderRow } from "@/components/material-order-row";

export default async function MaterialOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  // Order lines in this season: each carries its main colour (product_colors) and quantity.
  const orderItemsResult = await supabase
    .from("order_items")
    .select("product_id, product_colors(material_color_id), order_item_sizes(quantity), orders!inner(season_id)")
    .eq("orders.season_id", seasonId);
  const orderItems: any[] = orderItemsResult.data ?? [];
  const productIds = Array.from(new Set(orderItems.map((it) => it.product_id)));

  if (orderItems.length === 0) {
    return (
      <div className="space-y-6">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">← Season List</Link>
        <h1 className="text-2xl font-semibold text-gray-900">Material Order: {season.name}</h1>
        <p className="text-gray-400 text-sm">No ordered products in this season yet</p>
      </div>
    );
  }

  const [productsResult, pmResult, materialColorsResult, moResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, main_material_id, main_m_quantity, lining_material_id, lining_m_quantity, lining_material_color_id")
      .in("id", productIds),
    supabase
      .from("product_materials")
      .select("product_id, material_id, usage_amount, material_color_id")
      .in("product_id", productIds),
    supabase.from("material_colors").select("id, color, materials(id, name, unit_type)"),
    supabase.from("material_orders").select("material_color_id, sample_remaining, order_qty, notes").eq("season_id", seasonId),
  ]);

  const productsMap = new Map((productsResult.data ?? []).map((p: any) => [p.id, p]));
  const pmsByProduct = new Map<string, any[]>();
  for (const pm of pmResult.data ?? []) {
    const arr = pmsByProduct.get(pm.product_id) ?? [];
    arr.push(pm);
    pmsByProduct.set(pm.product_id, arr);
  }

  // Aggregate usage by material colour: main → the order line's colour;
  // lining & additional materials → their pinned colour. usage = per-unit × ordered qty.
  const usageByColor = new Map<string, number>();
  const add = (mcId: string | null | undefined, amt: number) => {
    if (!mcId || !amt) return;
    usageByColor.set(mcId, (usageByColor.get(mcId) ?? 0) + amt);
  };
  for (const it of orderItems) {
    const qty = (it.order_item_sizes ?? []).reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);
    if (qty <= 0) continue;
    const p: any = productsMap.get(it.product_id);
    if (!p) continue;
    const mainColor = it.product_colors?.material_color_id as string | undefined;
    if (p.main_material_id) add(mainColor, Number(p.main_m_quantity ?? 0) * qty);
    if (p.lining_material_id) add(p.lining_material_color_id, Number(p.lining_m_quantity ?? 0) * qty);
    for (const pm of pmsByProduct.get(it.product_id) ?? []) {
      add(pm.material_color_id, Number(pm.usage_amount ?? 0) * qty);
    }
  }

  const mcMap = new Map((materialColorsResult.data ?? []).map((mc: any) => [mc.id, mc]));
  const moMap = new Map((moResult.data ?? []).map((mo: any) => [mo.material_color_id, mo]));

  const rows = Array.from(usageByColor.entries())
    .map(([materialColorId, totalUsage]) => {
      const mc: any = mcMap.get(materialColorId);
      const mo: any = moMap.get(materialColorId);
      return {
        materialColorId,
        materialId: mc?.materials?.id ?? null,
        materialName: mc?.materials?.name ?? "—",
        colour: mc?.color ?? "—",
        unitType: mc?.materials?.unit_type ?? "",
        totalUsage,
        mo,
      };
    })
    .filter((r) => r.materialId)
    .sort((a, b) => (a.materialName.localeCompare(b.materialName, "ja") || a.colour.localeCompare(b.colour)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">← Season List</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Material Order: {season.name}</h1>

      {rows.length === 0 ? (
        <p className="text-gray-400 text-sm">No materials with colours configured on the ordered products</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colour</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Usage</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sample Remaining</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net Required</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Order Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <MaterialOrderRow
                  key={row.materialColorId}
                  seasonId={seasonId}
                  materialColorId={row.materialColorId}
                  materialId={row.materialId as string}
                  materialName={row.materialName}
                  colour={row.colour}
                  unitType={row.unitType}
                  totalUsage={row.totalUsage}
                  initialSampleRemaining={Number(row.mo?.sample_remaining ?? 0)}
                  initialOrderQty={Number(row.mo?.order_qty ?? 0)}
                  initialNotes={row.mo?.notes ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
