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

  // Fetch all products in this season with their materials
  const productsResult = await supabase
    .from("products")
    .select("id")
    .eq("season_id", seasonId)
    .eq("is_invalid", false);
  const productIds = (productsResult.data ?? []).map((p) => p.id);

  if (productIds.length === 0) {
    return (
      <div className="space-y-6">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">← Season List</Link>
        <h1 className="text-2xl font-semibold text-gray-900">Material Order: {season.name}</h1>
        <p className="text-gray-400 text-sm">No products in this season</p>
      </div>
    );
  }

  // Fetch product_materials for this season's products
  const pmResult = await supabase
    .from("product_materials")
    .select("product_id, material_id, usage_amount, materials(id, name, unit_type, unit_price_jpy)")
    .in("product_id", productIds);

  // Aggregate total ordered quantity per product from orders in this season
  const ordersResult = await supabase
    .from("orders")
    .select("id")
    .eq("season_id", seasonId);
  const orderIds = (ordersResult.data ?? []).map((o) => o.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sizesMap = new Map<string, number>(); // productId → total qty

  if (orderIds.length > 0) {
    const orderItemsResult = await supabase
      .from("order_items")
      .select("product_id, order_item_sizes(quantity)")
      .in("order_id", orderIds);

    for (const item of orderItemsResult.data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = ((item as any).order_item_sizes ?? []).reduce(
        (s: number, sz: { quantity: number }) => s + sz.quantity, 0
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pid = (item as any).product_id;
      sizesMap.set(pid, (sizesMap.get(pid) ?? 0) + total);
    }
  }

  // Calculate total_usage per material
  const materialUsageMap = new Map<string, { name: string; unitType: string; totalUsage: number }>();
  for (const pm of pmResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat: any = (pm as any).materials;
    if (!mat) continue;
    const orderedQty = sizesMap.get(pm.product_id) ?? 0;
    const usage = Number(pm.usage_amount) * orderedQty;
    if (!materialUsageMap.has(pm.material_id)) {
      materialUsageMap.set(pm.material_id, { name: mat.name, unitType: mat.unit_type, totalUsage: 0 });
    }
    materialUsageMap.get(pm.material_id)!.totalUsage += usage;
  }

  // Fetch existing material_orders for this season
  const moResult = await supabase
    .from("material_orders")
    .select("material_id, sample_remaining, order_qty, notes")
    .eq("season_id", seasonId);

  const moMap = new Map((moResult.data ?? []).map((mo) => [mo.material_id, mo]));

  const materialRows = Array.from(materialUsageMap.entries())
    .map(([materialId, data]) => ({ materialId, ...data, mo: moMap.get(materialId) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">← Season List</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Material Order: {season.name}</h1>

      {materialRows.length === 0 ? (
        <p className="text-gray-400 text-sm">No products with materials configured</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total Usage</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Sample Remaining</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net Required</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Order Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {materialRows.map((row) => (
                <MaterialOrderRow
                  key={row.materialId}
                  seasonId={seasonId}
                  materialId={row.materialId}
                  materialName={row.name}
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
