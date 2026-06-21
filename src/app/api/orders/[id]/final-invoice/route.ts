import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { OcDocument } from "@/lib/pdf/oc-document";
import { buildOcProps } from "@/lib/pdf/oc-data";
import { OC_LABELS } from "@/lib/pdf/labels";

// Final Invoice preview (draft of all items, no deposit deducted). The saved
// batch version is generated via the popup with explicit item selection.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureFonts();
  const supabase = await createClient();

  const props: any = await buildOcProps(supabase, id);
  if (!props) return new Response("Not found", { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(OcDocument, {
    ...props,
    variant: "final",
    numberText: `${OC_LABELS[props.lang as "en" | "ja"].invoiceNo} INV-${String(props.invoiceCount).padStart(4, "0")}`,
    depositApplied: 0,
    issueDate: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/"),
  }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="FinalInvoice-${id.slice(0, 8)}.pdf"`,
    },
  });
}
