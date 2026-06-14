import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { CompositionTagDocument } from "@/lib/pdf/tag-documents";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureFonts();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("name, product_compositions(rate, composition_options(name))")
    .eq("id", id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = product;
  if (!p) return new Response("Not found", { status: 404 });

  const compositions = (p.product_compositions ?? []).map(
    (pc: { rate: number; composition_options: { name: string } | null }) =>
      `${pc.composition_options?.name ?? "?"} ${pc.rate}%`
  );

  const tags = [{ productName: p.name, compositions }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(CompositionTagDocument, { tags }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CompositionTag-${id.slice(0, 8)}.pdf"`,
    },
  });
}
