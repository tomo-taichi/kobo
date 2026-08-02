import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { ProductTagDocument, CompositionTagDocument } from "@/lib/pdf/tag-documents";
import { colorSku } from "@/lib/format";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tagType = searchParams.get("type") ?? "product"; // "product" | "composition"
  const model = searchParams.get("model"); // optional: limit to one model

  ensureFonts();
  const supabase = await createClient();

  const { data: season } = await supabase.from("seasons").select("name").eq("id", id).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasonName = (season as any)?.name ?? "—";

  const { data: products } = await supabase
    .from("products")
    .select("id, name, model_name, product_number, cleaning_instruction, product_compositions(rate, composition_options(name)), product_colors(id, sort_order, material_colors(color))")
    .eq("season_id", id)
    .eq("is_invalid", false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let productList = (products ?? []) as any[];
  if (model) productList = productList.filter((p) => (p.model_name || p.name) === model);
  const scope = model ? "Model" : `Season-${id.slice(0, 8)}`;

  // One tag per colour (SKU = product number + colour index).
  type ColorTag = {
    sku: string;
    color: string | null;
    modelName: string;
    cleaningInstruction: string | null;
    compositions: string[];
  };
  const colorTags: ColorTag[] = [];
  for (const p of productList) {
    const compositions = (p.product_compositions ?? []).map(
      (pc: { rate: number; composition_options: { name: string } | null }) =>
        `${pc.composition_options?.name ?? "?"} ${pc.rate}%`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colors = ((p.product_colors ?? []) as any[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    colors.forEach((pc, idx) => {
      colorTags.push({
        sku: colorSku(p.product_number, idx + 1),
        color: pc.material_colors?.color ?? null,
        modelName: p.model_name || p.name || "—",
        cleaningInstruction: p.cleaning_instruction ?? null,
        compositions,
      });
    });
  }

  if (tagType === "composition") {
    const tags = colorTags.map((t) => ({
      productName: `${t.modelName}${t.color ? ` / ${t.color}` : ""}`,
      compositions: t.compositions,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await renderToStream(React.createElement(CompositionTagDocument, { tags }) as any);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CompositionTags-${scope}.pdf"`,
      },
    });
  }

  const tags = colorTags.map((t) => ({
    productNumber: t.sku,
    color: t.color,
    cleaningInstruction: t.cleaningInstruction,
    seasonName,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(ProductTagDocument, { tags }) as any);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ProductTags-${scope}.pdf"`,
    },
  });
}
