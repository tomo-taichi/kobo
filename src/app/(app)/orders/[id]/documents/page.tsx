import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toggleOrderItemFlag, incrementInvoiceCount } from "@/app/actions/order-financials";
import { saveOcPdf } from "@/app/actions/pdf-storage";
import { PdfSaveButton } from "@/components/pdf-save-button";
import { DepositGenerateButton } from "@/components/deposit-generate-button";
import { BatchGenerateButton } from "@/components/batch-generate-button";
import { fmtEur } from "@/lib/format";

export default async function OrderDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [orderResult, itemsResult, docsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("invoice_count, pdf_oc_url, pdf_deposit_url, pdf_final_url, pdf_commercial_url, customers(deposit_terms, group_type, currency)")
      .eq("id", id)
      .single(),
    supabase
      .from("order_items")
      .select("id, customer_wholesale_eur, is_flagged_invoice, is_flagged_delivery, products(name, model_name, product_number, color), order_item_sizes(quantity)")
      .eq("order_id", id)
      .order("created_at"),
    supabase
      .from("order_documents")
      .select("id, doc_type, seq_no, item_ids, total_qty, total_amount, order_document_versions(version_no, version_label, file_url, created_at)")
      .eq("order_id", id),
  ]);

  if (!orderResult.data) notFound();

  const order: any = orderResult.data;
  const invoiceCount = Number(order.invoice_count ?? 0);
  const items: any[] = itemsResult.data ?? [];
  const hasAnyFlag = items.some((i) => i.is_flagged_invoice || i.is_flagged_delivery);
  const showAdvance = order.customers?.deposit_terms === "Deposit_and_Production";
  const isDomestic = order.customers?.group_type === "Domestic";
  const currency = order.customers?.currency === "JPY" ? "JPY" : "EUR";

  const fmtAmount = (n: number) =>
    currency === "JPY"
      ? `¥${Math.round(n).toLocaleString("en")}`
      : `€${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const DOC_TYPE_LABELS: Record<string, string> = {
    oc: "Order Confirmation",
    deposit: "Advance Invoice",
    final: "Final Invoice",
    commercial: "Commercial Invoice",
    delivery: "Delivery Note",
  };

  // Batch picker items — "processed" comes from the flags (per doc_type)
  const batchItemsFor = (dt: "final" | "commercial" | "delivery") =>
    items.map((it: any) => ({
      id: it.id,
      productId: it.products?.product_number ?? "—",
      modelName: it.products?.model_name ?? it.products?.name ?? "—",
      color: it.products?.color ?? null,
      qty: (it.order_item_sizes ?? []).reduce((s: number, r: any) => s + r.quantity, 0),
      processed: dt === "final" ? !!it.is_flagged_invoice : !!it.is_flagged_delivery,
    }));
  const batchDocsFor = (dt: string) =>
    ((docsResult.data ?? []) as any[])
      .filter((d) => d.doc_type === dt)
      .map((d) => {
        const vers = (d.order_document_versions ?? []).slice().sort((a: any, b: any) => b.version_no - a.version_no);
        return { documentId: d.id, seqNo: d.seq_no, itemIds: (d.item_ids ?? []) as string[], versionLabel: vers[0]?.version_label ?? null };
      })
      .sort((a, b) => a.seqNo - b.seqNo);

  // Flatten all saved versions (newest first), carrying the doc's snapshot totals
  const versions = ((docsResult.data ?? []) as any[])
    .flatMap((d) =>
      (d.order_document_versions ?? []).map((v: any) => ({
        docType: d.doc_type as string,
        seqNo: d.seq_no as number,
        versionLabel: v.version_label as string,
        fileUrl: v.file_url as string | null,
        createdAt: v.created_at as string,
        totalQty: Number(d.total_qty ?? 0),
        totalAmount: Number(d.total_amount ?? 0),
      })),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // PDF document buttons (gated by deposit terms / domestic vs overseas)
  const docButtons = [
    { kind: "oc", label: "Order Confirmation", previewHref: `/api/orders/${id}/oc`, savedUrl: order.pdf_oc_url, saveAction: saveOcPdf.bind(null, id) },
    showAdvance ? { kind: "deposit", label: "Advance Invoice", previewHref: `/api/orders/${id}/deposit-invoice`, savedUrl: order.pdf_deposit_url } : null,
    { kind: "batch", docType: "final", label: "Final Invoice", previewHref: `/api/orders/${id}/final-invoice`, savedUrl: order.pdf_final_url },
    isDomestic
      ? { kind: "batch", docType: "delivery", label: "Delivery Note", previewHref: `/api/orders/${id}/commercial-invoice?type=domestic`, savedUrl: order.pdf_commercial_url }
      : { kind: "batch", docType: "commercial", label: "Commercial Invoice", previewHref: `/api/orders/${id}/commercial-invoice`, savedUrl: order.pdf_commercial_url },
  ].filter(Boolean) as any[];

  return (
    <div className="space-y-4">

      {/* ── PDF Documents (buttons row, top) ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Create PDF</h2>
        <div className="flex flex-wrap gap-4">
          {docButtons.map((b) => (
            <div key={b.label} className="flex flex-col gap-1.5 border border-gray-100 rounded-lg p-3 min-w-44">
              <span className="text-sm font-medium text-gray-700">{b.label}</span>
              <a href={b.previewHref} target="_blank" rel="noreferrer"
                className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 text-center">
                Preview
              </a>
              {b.kind === "deposit" ? (
                <DepositGenerateButton orderId={id} savedUrl={b.savedUrl} />
              ) : b.kind === "batch" ? (
                <BatchGenerateButton orderId={id} docType={b.docType} items={batchItemsFor(b.docType)} existingDocs={batchDocsFor(b.docType)} savedUrl={b.savedUrl} />
              ) : (
                <PdfSaveButton label="Generate & Save" savedUrl={b.savedUrl} action={b.saveAction} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Invoice & Delivery Flags (status: invoiced / delivered) ── */}
      {items.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">Invoice &amp; Delivery Status</h2>
            {hasAnyFlag && (
              <form action={incrementInvoiceCount.bind(null, id)}>
                <button type="submit" className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600">
                  Mark Invoice Issued (#{invoiceCount} → #{invoiceCount + 1})
                </button>
              </form>
            )}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">Product</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">WS (EUR)</th>
                <th className="text-center px-4 py-2 font-medium text-gray-400">Qty</th>
                <th className="text-center px-4 py-2 font-medium text-gray-400">Invoiced</th>
                <th className="text-center px-4 py-2 font-medium text-gray-400">Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const qty = (item.order_item_sizes ?? []).reduce((s: number, r: any) => s + r.quantity, 0);
                const name = item.products?.model_name ?? item.products?.name ?? "—";
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">{name}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-600">€ {fmtEur(Number(item.customer_wholesale_eur))}</td>
                    <td className="px-4 py-2 text-center text-gray-500">{qty}</td>
                    <td className="px-4 py-2 text-center">
                      <form action={toggleOrderItemFlag.bind(null, id, item.id, "is_flagged_invoice", !item.is_flagged_invoice)}>
                        <button type="submit"
                          className={`px-2.5 py-0.5 rounded text-xs ${item.is_flagged_invoice ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                          {item.is_flagged_invoice ? "✓ Invoiced" : "—"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <form action={toggleOrderItemFlag.bind(null, id, item.id, "is_flagged_delivery", !item.is_flagged_delivery)}>
                        <button type="submit"
                          className={`px-2.5 py-0.5 rounded text-xs ${item.is_flagged_delivery ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}>
                          {item.is_flagged_delivery ? "✓ Delivered" : "—"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Saved Versions (history) ── */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">Saved Versions</h2>
          <p className="text-xs text-gray-400 mt-0.5">Every generated file is versioned (YYMMDD_vNN) and downloadable here.</p>
        </div>
        {versions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No saved documents yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-400">Document</th>
                <th className="text-left px-4 py-2 font-medium text-gray-400">Version</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">Items</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400">Total</th>
                <th className="text-left px-4 py-2 font-medium text-gray-400">Generated</th>
                <th className="text-right px-4 py-2 font-medium text-gray-400"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {versions.map((v, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800">
                    {DOC_TYPE_LABELS[v.docType] ?? v.docType}
                    {v.seqNo > 1 ? <span className="text-gray-400"> · batch {v.seqNo}</span> : null}
                  </td>
                  <td className="px-4 py-2 font-mono text-gray-600">{v.versionLabel}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{v.totalQty}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-700">{fmtAmount(v.totalAmount)}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(v.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    {v.fileUrl ? (
                      <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
