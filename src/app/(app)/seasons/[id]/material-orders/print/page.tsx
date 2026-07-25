import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildMaterialUsage } from "@/lib/material-usage";
import { PrintButton } from "@/components/print-button";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ADR-0009 Phase 2 — printable per-season material aggregation.
// One sheet listing, for every Material×Color, the order lines that consume it and
// the total quantity needed for production. Chrome is hidden on print via the inline
// @media print rules below so browser "Save as PDF" yields a single clean document.
export default async function MaterialAggregationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const groups = await buildMaterialUsage(supabase, seasonId);
  const generatedAt = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/");

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          .mat-group { break-inside: avoid; }
          @page { margin: 14mm; }
        }
      `}</style>

      <div className="print-root space-y-4 text-gray-900">
        <div className="no-print flex items-center justify-between gap-3">
          <Link href={`/seasons/${seasonId}/material-orders`} className="text-sm text-gray-500 hover:text-gray-900">
            ← Material Order
          </Link>
          <PrintButton />
        </div>

        <div className="flex items-end justify-between border-b-2 border-gray-800 pb-2">
          <div>
            <h1 className="text-xl font-bold">Material Aggregation</h1>
            <p className="text-sm text-gray-500">{season.name}</p>
          </div>
          <p className="text-xs text-gray-500">Generated {generatedAt}</p>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No materials to aggregate for this season yet.</p>
        ) : (
          groups.map((g) => (
            <div key={g.materialColorId} className="mat-group border border-gray-300 rounded overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-100 border-b border-gray-300">
                <div className="min-w-0 text-sm">
                  <span className="text-gray-500">{g.supplierName ?? "—"}</span>
                  {g.materialNumber ? <span className="ml-2 text-gray-400">M.ID {g.materialNumber}</span> : null}
                  <span className="ml-2 font-semibold">{g.materialName}</span>
                  {g.materialCategory ? <span className="ml-2 text-gray-400">{g.materialCategory}</span> : null}
                  <span className="ml-2 font-medium text-gray-700">/ {g.colour}</span>
                </div>
                <div className="shrink-0 text-sm font-mono font-semibold">
                  {fmt(g.totalUsage)} {g.unitType}
                </div>
              </div>

              {/* Lines */}
              <table className="w-full text-xs">
                <thead className="border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium">P.ID</th>
                    <th className="text-left px-3 py-1.5 font-medium">Role</th>
                    <th className="text-left px-3 py-1.5 font-medium">Product</th>
                    <th className="text-left px-3 py-1.5 font-medium">Order</th>
                    <th className="text-right px-3 py-1.5 font-medium">Per Unit</th>
                    <th className="text-left px-3 py-1.5 font-medium">Sizes</th>
                    <th className="text-right px-3 py-1.5 font-medium">Units</th>
                    <th className="text-right px-3 py-1.5 font-medium">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-mono text-gray-600">{l.productNumber ?? "—"}</td>
                      <td className="px-3 py-1.5 text-gray-600">{l.role}</td>
                      <td className="px-3 py-1.5">{l.modelName}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {l.orderNumber ?? "—"}
                        {l.customerName ? <span className="text-gray-400"> · {l.customerName}</span> : null}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600">{fmt(l.perUnitUsage)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">
                        {l.sizes.map((s) => `${s.size}:${s.qty}`).join("  ") || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.units}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-400 bg-gray-50">
                    <td colSpan={7} className="px-3 py-1.5 text-right font-medium text-gray-700">Total</td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold">
                      {fmt(g.totalUsage)} {g.unitType}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))
        )}
      </div>
    </>
  );
}
