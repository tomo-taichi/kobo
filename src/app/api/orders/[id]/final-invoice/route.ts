import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { FinalInvoiceDocument } from "@/lib/pdf/final-invoice-document";
import { getLang, buildPaymentTerms, bankDetailLines } from "@/lib/pdf/labels";

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureFonts();
  const supabase = await createClient();

  const [orderResult, itemsResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, currency_type, exchange_rate, deposit_rate, invoice_count, customers(name, group_type, currency, bank, deposit_terms, billing_company, billing_address, billing_city, billing_country), seasons(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("order_items")
      .select("customer_wholesale_eur, products(product_number, product_category, model_name, name, color), order_item_sizes(size, quantity)")
      .eq("order_id", id)
      .eq("is_flagged_invoice", true),
    supabase
      .from("company_settings")
      .select("name_en, name_ja, address_en, address_ja, nickname, bank_wise_eu, bank_rakuten_jp")
      .single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order: any = orderResult.data;
  if (!order) return new Response("Not found", { status: 404 });

  const lang = getLang(order.customers?.group_type);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = companyResult.data;
  const company = {
    name: lang === "ja" ? (cs?.name_ja ?? "taichimurakami") : (cs?.name_en ?? "taichimurakami"),
    address: lang === "ja" ? (cs?.address_ja ?? "") : (cs?.address_en ?? ""),
    nickname: cs?.nickname ?? "taichimurakami",
  };

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
  }));

  const customerName = order.customers?.billing_company || order.customers?.name || "—";
  const customerAddress = buildCustomerAddress(order.customers);

  const paymentTerms = buildPaymentTerms(
    order.customers?.group_type,
    order.customers?.deposit_terms === "Deposit_and_Production",
    Math.round(Number(order.deposit_rate ?? 0) * 100),
    company.nickname,
  );
  const bankDetails = bankDetailLines(order.customers?.bank, cs?.bank_wise_eu, cs?.bank_rakuten_jp);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = await renderToStream(React.createElement(FinalInvoiceDocument, {
    lang,
    company,
    customerName,
    customerAddress,
    seasonName: order.seasons?.name ?? "—",
    orderDate: order.order_date,
    currency: order.customers?.currency === "JPY" ? "JPY" : "EUR",
    exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
    invoiceCount: order.invoice_count ?? 1,
    items,
    paymentTerms,
    bankDetails,
    depositAppliedEur: null,
  }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="FinalInvoice-${id.slice(0, 8)}.pdf"`,
    },
  });
}
