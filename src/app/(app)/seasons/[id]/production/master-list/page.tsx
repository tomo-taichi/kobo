import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildProductionRows } from "@/lib/production-view";
import { PrintButton } from "@/components/print-button";
import { SIZES } from "@/lib/order-constants";

// ADR-0009 Phase 3 (§3.2) — Production Master List.
// Print-friendly list of every product (Model × Color) with ordered quantity and
// size breakdown, sorted by model, for the production team to check on paper.
export default async function ProductionMasterListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const rows = await buildProductionRows(supabase, seasonId);
  const generatedAt = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/");
  const totalQty = rows.reduce((a, r) => a + r.orderedQty, 0);

  const sizeStr = (sizes: { size: string; qty: number }[]) =>
    [...sizes]
      .sort((a, b) => SIZES.indexOf(a.size as (typeof SIZES)[number]) - SIZES.indexOf(b.size as (typeof SIZES)[number]))
      .map((s) => `${s.size}:${s.qty}`)
      .join("  ");

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div className="print-root space-y-4 text-gray-900">
        <div className="no-print flex items-center justify-between gap-3">
          <Link href={`/seasons/${seasonId}/production`} className="text-sm text-gray-500 hover:text-gray-900">
            ← Production
          </Link>
          <PrintButton />
        </div>

        <div className="flex items-end justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-xl font-bold">Production Master List</h1>
            <p className="text-sm text-gray-500">{season.name}</p>
          </div>
          <p className="text-xs text-gray-500">
            {rows.length} items · {totalQty} pcs · Generated {generatedAt}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">No ordered products in this season yet.</p>
        ) : (
          <table className="w-full text-xs border border-gray-300">
            <thead className="bg-gray-100 border-b border-gray-300 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Model</th>
                <th className="text-left px-3 py-2 font-medium">P.ID</th>
                <th className="text-left px-3 py-2 font-medium">Color</th>
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Sex</th>
                <th className="text-left px-3 py-2 font-medium">Main Material</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-left px-3 py-2 font-medium">Sizes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.productId}|${r.productColorId ?? "none"}`} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium">{r.modelName}</td>
                  <td className="px-3 py-2 font-mono text-gray-600">{r.productNumber ?? "—"}</td>
                  <td className="px-3 py-2">{r.colorName ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.category ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.sex ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.mainMaterialName ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.orderedQty}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">{sizeStr(r.sizes) || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-400 bg-gray-50">
                <td colSpan={6} className="px-3 py-2 text-right font-medium text-gray-700">Total</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{totalQty}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
