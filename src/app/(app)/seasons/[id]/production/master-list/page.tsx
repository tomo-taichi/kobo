import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildProductionRows, buildBatchOrderDetails } from "@/lib/production-view";
import { buildColorSkuMap } from "@/lib/skus";
import { fmtProductId } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { SIZES } from "@/lib/order-constants";

// ADR-0009 Phase 3 (§3.2) — Production Master List (print).
// Grouped by model. Per colour: a production subtotal row + one row per client
// showing which sizes/qty they ordered + that client's order memo. Dense, A4-landscape.
export default async function ProductionMasterListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const rows = await buildProductionRows(supabase, seasonId);
  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const [detailsByColor, skuMap] = await Promise.all([
    buildBatchOrderDetails(supabase, seasonId),
    buildColorSkuMap(supabase, productIds),
  ]);
  const generatedAt = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/");

  const sizeMap = (sizes: { size: string; qty: number }[]) => {
    const m = new Map<string, number>();
    for (const s of sizes) m.set(s.size, s.qty);
    return m;
  };

  // Show used size columns, and always reserve "Free" (next to 10).
  const used = new Set<string>();
  for (const r of rows) for (const s of r.sizes) if (s.qty > 0) used.add(s.size);
  const usedSizes = SIZES.filter((s) => used.has(s) || s === "Free");

  const grandBySize = new Map<string, number>();
  let grandTotal = 0;
  for (const r of rows) {
    grandTotal += r.orderedQty;
    for (const s of r.sizes) grandBySize.set(s.size, (grandBySize.get(s.size) ?? 0) + s.qty);
  }

  const byModel = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byModel.get(r.modelName) ?? [];
    arr.push(r);
    byModel.set(r.modelName, arr);
  }
  const modelGroups = Array.from(byModel.entries())
    .map(([model, rs]) => ({
      model,
      rows: rs.slice().sort((a, b) => (a.colorName ?? "").localeCompare(b.colorName ?? "", "ja")),
    }))
    .sort((a, b) => a.model.localeCompare(b.model, "ja"));

  type RenderRow =
    | { kind: "model"; model: string }
    | { kind: "subtotal"; pid: string | null; mainMat: string | null; color: string | null; total: number; sizes: Map<string, number> }
    | { kind: "client"; client: string | null; total: number; sizes: Map<string, number>; memo: string };

  const renderRows: RenderRow[] = [];
  for (const g of modelGroups) {
    renderRows.push({ kind: "model", model: g.model });
    for (const r of g.rows) {
      renderRows.push({
        kind: "subtotal",
        pid: r.productColorId ? skuMap.get(r.productColorId) ?? fmtProductId(r.productNumber) : fmtProductId(r.productNumber),
        mainMat: r.mainMaterialName,
        color: r.colorName,
        total: r.orderedQty,
        sizes: sizeMap(r.sizes),
      });
      const clients = r.productColorId ? detailsByColor.get(r.productColorId) ?? [] : [];
      for (const c of clients) {
        renderRows.push({ kind: "client", client: c.customerName, total: c.units, sizes: sizeMap(c.sizes), memo: c.memo });
      }
    }
  }

  const cell = "px-1.5 py-0.5 border-b border-gray-100";
  const numCell = cell + " text-right font-mono whitespace-nowrap";
  const colCount = 5 + usedSizes.length + 1; // P.ID, MainMat, Color, Client, Total, sizes…, Memo

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root { position: absolute; left: 0; top: 0; width: 100%; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      <div className="print-root text-gray-900 text-[10px]">
        <div className="no-print flex items-center justify-between gap-3 mb-3">
          <Link href={`/seasons/${seasonId}/production`} className="text-sm text-gray-500 hover:text-gray-900">
            ← Production
          </Link>
          <PrintButton />
        </div>

        <div className="flex items-end justify-between border-b-2 border-gray-800 pb-1 mb-2">
          <div>
            <h1 className="text-base font-bold leading-tight">Production Master List</h1>
            <p className="text-[11px] text-gray-500">{season.name}</p>
          </div>
          <p className="text-[10px] text-gray-500">
            {rows.length} items · {grandTotal} pcs · {generatedAt}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">No ordered products in this season yet.</p>
        ) : (
          <table className="w-full border border-gray-300">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className={cell + " text-left font-medium"}>P.ID</th>
                <th className={cell + " text-left font-medium"}>Main Material</th>
                <th className={cell + " text-left font-medium"}>Color</th>
                <th className={cell + " text-left font-medium"}>Client</th>
                <th className={cell + " text-right font-medium"}>Total</th>
                {usedSizes.map((s) => (
                  <th key={s} className={cell + " text-right font-medium w-7"}>{s === "Free" ? "F" : s}</th>
                ))}
                <th className={cell + " text-left font-medium min-w-[240px] w-1/4"}>Memo</th>
              </tr>
            </thead>
            <tbody>
              {renderRows.map((row, i) => {
                if (row.kind === "model") {
                  return (
                    <tr key={i} className="bg-gray-800 text-white">
                      <td colSpan={colCount} className="px-1.5 py-1 font-bold">{row.model}</td>
                    </tr>
                  );
                }
                if (row.kind === "subtotal") {
                  return (
                    <tr key={i} className="bg-indigo-50 font-semibold border-t border-indigo-200">
                      <td className={cell + " font-mono text-indigo-800 border-l-2 border-indigo-500"}>{row.pid ?? "—"}</td>
                      <td className={cell + " text-gray-700 max-w-[160px] truncate"} title={row.mainMat ?? ""}>{row.mainMat ?? "—"}</td>
                      <td className={cell + " text-gray-900"}>{row.color ?? "—"}</td>
                      <td className={cell + " text-indigo-700 uppercase tracking-wide"}>Total</td>
                      <td className={numCell + " text-indigo-700"}>{row.total}</td>
                      {usedSizes.map((s) => (
                        <td key={s} className={numCell + " text-gray-900"}>{row.sizes.get(s) || ""}</td>
                      ))}
                      <td className={cell}></td>
                    </tr>
                  );
                }
                return (
                  <tr key={i}>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell}></td>
                    <td className={cell + " pl-4 text-gray-600"}>{row.client ?? "—"}</td>
                    <td className={numCell + " text-gray-600"}>{row.total}</td>
                    {usedSizes.map((s) => (
                      <td key={s} className={numCell + " text-gray-500"}>{row.sizes.get(s) || ""}</td>
                    ))}
                    <td className={cell + " text-gray-600 whitespace-normal min-w-[240px] w-1/4"}>{row.memo}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-400 bg-gray-100 font-semibold">
                <td colSpan={4} className="px-1.5 py-1 text-right text-gray-700">TOTAL</td>
                <td className={numCell}>{grandTotal}</td>
                {usedSizes.map((s) => (
                  <td key={s} className={numCell}>{grandBySize.get(s) || ""}</td>
                ))}
                <td className={cell}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
