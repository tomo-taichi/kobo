import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { OcDocument } from "@/lib/pdf/oc-document";
import { buildOcProps } from "@/lib/pdf/oc-data";
import { OC_LABELS } from "@/lib/pdf/labels";

// Advance Invoice preview (draft — no deadline). Saved version is generated via the popup.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureFonts();
  const supabase = await createClient();

  const props: any = await buildOcProps(supabase, id);
  if (!props) return new Response("Not found", { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(OcDocument, {
    ...props,
    variant: "advance",
    numberText: `${OC_LABELS[props.lang as "en" | "ja"].invoiceNo} DEP-${String(props.invoiceCount + 1).padStart(4, "0")}`,
    paymentDeadline: null,
  }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="AdvanceInvoice-${id.slice(0, 8)}.pdf"`,
    },
  });
}
