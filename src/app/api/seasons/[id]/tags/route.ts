import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { ProductTagDocument, CompositionTagDocument } from "@/lib/pdf/tag-documents";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tagType = searchParams.get("type") ?? "product"; // "product" | "composition"

  ensureFonts();
  const supabase = await createClient();

  const { data: season } = await supabase.from("seasons").select("name").eq("id", id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasonName = (season as any)?.name ?? "—";

  const { data: products } = await supabase
    .from("products")
    .select("id, name, product_number, cleaning_instruction, product_compositions(rate, composition_options(name))")
    .eq("season_id", id)
    .eq("is_invalid", false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productList = (products ?? []) as any[];

  if (tagType === "composition") {
    const tags = productList.map((p) => ({
      productName: p.name,
      compositions: (p.product_compositions ?? []).map(
        (pc: { rate: number; composition_options: { name: string } | null }) =>
          `${pc.composition_options?.name ?? "?"} ${pc.rate}%`
      ),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(React.createElement(CompositionTagDocument, { tags }) as any);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CompositionTags-Season-${id.slice(0, 8)}.pdf"`,
      },
    });
  }

  const tags = productList.map((p) => ({
    productNumber: p.product_number,
    cleaningInstruction: p.cleaning_instruction,
    seasonName,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(ProductTagDocument, { tags }) as any);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ProductTags-Season-${id.slice(0, 8)}.pdf"`,
    },
  });
}
