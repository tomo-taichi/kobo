import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { CommercialInvoiceDocument } from "@/lib/pdf/commercial-invoice-document";
import { DeliveryNoteDocument } from "@/lib/pdf/delivery-note-document";
import { getLang } from "@/lib/pdf/labels";
import { buildDeliveryNoteProps } from "@/lib/pdf/oc-data";

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  return `P${String(n).padStart(6, "0")}`;
}

function buildCustomerAddress(customer: any): string {
  return [customer?.billing_address, customer?.billing_city, customer?.billing_country]
    .filter(Boolean)
    .join(", ");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const forceType = searchParams.get("type");

  ensureFonts();
  const supabase = await createClient();

  const [orderResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, currency_type, exchange_rate, customers(name, group_type, currency, billing_company, billing_address, billing_city, billing_country), seasons(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("company_settings")
      .select("name_en, name_ja, address_en, address_ja, nickname")
      .single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order: any = orderResult.data;
  if (!order) return new Response("Not found", { status: 404 });

  // Language + shipping-doc type follow currency; override via ?type=domestic param
  const lang = getLang(order.customers?.currency);
  const isOverseas = forceType ? forceType !== "domestic" : order.customers?.currency !== "JPY";

  // Domestic Delivery Note (納品書) — dedicated Japanese all-¥ layout (preview = all items)
  if (!isOverseas) {
    const dn: any = await buildDeliveryNoteProps(supabase, id);
    if (!dn) return new Response("Not found", { status: 404 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dnStream = await renderToStream(React.createElement(DeliveryNoteDocument, { ...dn }) as any);
    return new Response(dnStream as unknown as ReadableStream, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="DeliveryNote-${id.slice(0, 8)}.pdf"` },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = companyResult.data;
  const company = {
    name: lang === "ja" ? (cs?.name_ja ?? "taichimurakami") : (cs?.name_en ?? "taichimurakami"),
    address: lang === "ja" ? (cs?.address_ja ?? "") : (cs?.address_en ?? ""),
    nickname: cs?.nickname ?? "taichimurakami",
  };

  const flagField = isOverseas ? "is_flagged_invoice" : "is_flagged_delivery";
  const itemsResult = await supabase
    .from("order_items")
    .select("customer_wholesale_eur, products(product_number, product_category, model_name, name, color, product_materials(materials(name))), order_item_sizes(size, quantity)")
    .eq("order_id", id)
    .eq(flagField, true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (itemsResult.data ?? []).map((item: any) => ({
    productId: fmtId(item.products?.product_number),
    productCategory: item.products?.product_category ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    color: item.products?.color ?? null,
    customerWholesaleEur: Number(item.customer_wholesale_eur),
    sizes: (item.order_item_sizes ?? []).map((s: { size: string; quantity: number }) => ({
      size: s.size,
      quantity: s.quantity,
    })),
    materials: (item.products?.product_materials ?? []).map((pm: { materials: { name: string } | null }) => pm.materials?.name ?? "").filter(Boolean),
  }));

  const customerName = order.customers?.billing_company || order.customers?.name || "—";
  const customerAddress = buildCustomerAddress(order.customers);

  const filename = isOverseas
    ? `CommercialInvoice-${id.slice(0, 8)}.pdf`
    : `DeliveryNote-${id.slice(0, 8)}.pdf`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(CommercialInvoiceDocument, {
    lang,
    company,
    customerName,
    customerAddress,
    seasonName: order.seasons?.name ?? "—",
    orderDate: order.order_date,
    currencyType: order.currency_type,
    exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
    isOverseas,
    items,
  }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
