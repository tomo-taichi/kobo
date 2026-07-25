import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { PurchaseOrderDocument } from "@/lib/pdf/purchase-order-document";
import { buildPurchaseOrderData } from "@/lib/purchase-order";

// ADR-0009 Phase 2 — Purchase Order PDF for one supplier in a season.
// GET /api/seasons/[id]/purchase-order?supplier=<supplierId>
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierId = new URL(request.url).searchParams.get("supplier");
  if (!supplierId) return new Response("Missing supplier", { status: 400 });

  ensureFonts();
  const supabase = await createClient();

  const data = await buildPurchaseOrderData(supabase, id, supplierId);
  if (!data) return new Response("Not found", { status: 404 });
  if (data.rows.length === 0) return new Response("No ordered materials for this supplier", { status: 404 });

  const issueDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(PurchaseOrderDocument, { ...data, issueDate }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="PO-${id.slice(0, 8)}.pdf"`,
    },
  });
}
