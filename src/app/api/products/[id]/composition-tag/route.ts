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
    .select("name, model_name, product_compositions(rate, composition_options(name)), product_colors(id, sort_order, material_colors(color))")
    .eq("id", id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = product;
  if (!p) return new Response("Not found", { status: 404 });

  const compositions = (p.product_compositions ?? []).map(
    (pc: { rate: number; composition_options: { name: string } | null }) =>
      `${pc.composition_options?.name ?? "?"} ${pc.rate}%`
  );

  // One composition tag per colour (compositions are the same across colours).
  const modelName = p.model_name || p.name || "—";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colors = ((p.product_colors ?? []) as any[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const tags = (colors.length > 0 ? colors : [null]).map((pc) => ({
    productName: `${modelName}${pc?.material_colors?.color ? ` / ${pc.material_colors.color}` : ""}`,
    compositions,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(CompositionTagDocument, { tags }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CompositionTag-${id.slice(0, 8)}.pdf"`,
    },
  });
}
