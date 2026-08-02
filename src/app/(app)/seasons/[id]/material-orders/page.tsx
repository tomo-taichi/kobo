import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MaterialOrderRow } from "@/components/material-order-row";
import { buildOrderEmail } from "@/lib/purchase-order";
import { buildMaterialUsage, type UsageGroup } from "@/lib/material-usage";
import { ProductionTabNav } from "@/components/production-tab-nav";

export default async function MaterialOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const [usageGroups, moResult, companyResult, seasonsListResult] = await Promise.all([
    buildMaterialUsage(supabase, seasonId),
    supabase.from("material_orders").select("material_color_id, sample_remaining, order_qty, notes").eq("season_id", seasonId),
    supabase.from("company_settings").select("name_ja, name_en, address_ja, address_en, phone, email").limit(1).single(),
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false }),
  ]);
  const seasonsList = (seasonsListResult.data ?? []) as { id: string; name: string }[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moMap = new Map((moResult.data ?? []).map((mo: any) => [mo.material_color_id, mo]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const company: any = companyResult.data ?? {};
  const companyName = company.name_ja || company.name_en || "";
  const companyAddress = company.address_ja || company.address_en || "";

  // Group material-colours by supplier for the card layout (usageGroups already
  // arrive sorted by supplier → material → colour). "No supplier" bucket last.
  type Group = {
    supplierId: string | null;
    supplierName: string | null;
    supplierEmail: string | null;
    supplierPerson: string | null;
    rows: UsageGroup[];
  };
  const bySupplier = new Map<string, Group>();
  for (const ug of usageGroups) {
    const key = ug.supplierId ?? "__none__";
    const g: Group = bySupplier.get(key) ?? {
      supplierId: ug.supplierId,
      supplierName: ug.supplierName,
      supplierEmail: ug.supplierEmail,
      supplierPerson: ug.supplierPerson,
      rows: [],
    };
    g.rows.push(ug);
    bySupplier.set(key, g);
  }
  const groupList = Array.from(bySupplier.values());

  const buildMailto = (g: Group): string | null => {
    if (!g.supplierEmail) return null;
    const orderRows = g.rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r) => Number((moMap.get(r.materialColorId) as any)?.order_qty ?? 0) > 0)
      .map((r) => ({
        materialName: r.materialName,
        colour: r.colour,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderQty: Number((moMap.get(r.materialColorId) as any)?.order_qty ?? 0),
        unitType: r.unitType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notes: (moMap.get(r.materialColorId) as any)?.notes ?? null,
      }));
    if (orderRows.length === 0) return null;
    const { subject, body } = buildOrderEmail({
      seasonName: season.name,
      personName: g.supplierPerson,
      companyName,
      companyAddress,
      companyPhone: company.phone ?? null,
      companyEmail: company.email ?? null,
      rows: orderRows,
    });
    return `mailto:${g.supplierEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasOrderQty = (g: Group) => g.rows.some((r) => Number((moMap.get(r.materialColorId) as any)?.order_qty ?? 0) > 0);

  return (
    <div className="space-y-6">
      <ProductionTabNav seasonId={seasonId} seasons={seasonsList} active="material-order" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Material Order: {season.name}</h1>
        {groupList.length > 0 && (
          <Link
            href={`/seasons/${seasonId}/material-orders/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
          >
            Print View
          </Link>
        )}
      </div>

      {groupList.length === 0 ? (
        <p className="text-gray-400 text-sm">No materials to order for this season yet</p>
      ) : (
        groupList.map((g) => {
          const mailto = buildMailto(g);
          const canOrder = hasOrderQty(g);
          return (
            <div key={g.supplierId ?? "__none__"} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{g.supplierName ?? "No supplier assigned"}</span>
                  {g.supplierEmail ? <span className="ml-2 text-xs text-gray-400">{g.supplierEmail}</span> : null}
                </div>
                {g.supplierId ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {canOrder ? (
                      <a
                        href={`/api/seasons/${seasonId}/purchase-order?supplier=${g.supplierId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
                      >
                        発注書 PDF
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Enter order quantities to generate a PO</span>
                    )}
                    {mailto ? (
                      <a
                        href={mailto}
                        className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                      >
                        メール作成
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-amber-600 shrink-0">Set a supplier on these materials to generate a PO</span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Colour</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total Usage</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Net Required</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Order Qty</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {g.rows.map((row) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const mo = moMap.get(row.materialColorId) as any;
                    return (
                      <MaterialOrderRow
                        key={row.materialColorId}
                        seasonId={seasonId}
                        materialColorId={row.materialColorId}
                        materialId={row.materialId as string}
                        materialNumber={row.materialNumber}
                        materialName={row.materialName}
                        colour={row.colour}
                        unitType={row.unitType}
                        totalUsage={row.totalUsage}
                        initialSampleRemaining={Number(mo?.sample_remaining ?? 0)}
                        initialOrderQty={Number(mo?.order_qty ?? 0)}
                        initialNotes={mo?.notes ?? null}
                        lines={row.lines}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
