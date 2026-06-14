import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { ProductTagDocument } from "@/lib/pdf/tag-documents";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");

  ensureFonts();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("product_number, cleaning_instruction, seasons(name)")
    .eq("id", id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = product;
  if (!p) return new Response("Not found", { status: 404 });

  let seasonName = p.seasons?.name ?? "—";
  if (seasonId) {
    const { data: season } = await supabase.from("seasons").select("name").eq("id", seasonId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((season as any)?.name) seasonName = (season as any).name;
  }

  const tags = [
    { productNumber: p.product_number, cleaningInstruction: p.cleaning_instruction, seasonName },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(ProductTagDocument, { tags }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Tag-${id.slice(0, 8)}.pdf"`,
    },
  });
}
