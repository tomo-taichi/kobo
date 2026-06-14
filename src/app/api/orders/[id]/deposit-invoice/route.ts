import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { DepositInvoiceDocument } from "@/lib/pdf/deposit-invoice-document";
import { getLang, buildPaymentTerms, bankDetailLines } from "@/lib/pdf/labels";

function buildCustomerAddress(customer: any): string {
  return [customer?.billing_address, customer?.billing_city, customer?.billing_country]
    .filter(Boolean)
    .join(", ");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  ensureFonts();
  const supabase = await createClient();

  const [orderResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, invoice_type, currency_type, deposit_rate, deposit_amount_eur, deposit_amount_jpy, invoice_count, customers(name, group_type, currency, bank, deposit_terms, billing_company, billing_address, billing_city, billing_country), seasons(name)")
      .eq("id", id)
      .single(),
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
  const stream = await renderToStream(React.createElement(DepositInvoiceDocument, {
    lang,
    company,
    customerName,
    customerAddress,
    seasonName: order.seasons?.name ?? "—",
    orderDate: order.order_date,
    currency: order.customers?.currency === "JPY" ? "JPY" : "EUR",
    depositAmountEur: order.deposit_amount_eur ? Number(order.deposit_amount_eur) : null,
    depositAmountJpy: order.deposit_amount_jpy ? Number(order.deposit_amount_jpy) : null,
    invoiceCount: order.invoice_count ?? 0,
    paymentTerms,
    bankDetails,
    paymentDeadline: null,
  }) as any);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="DepositInvoice-${id.slice(0, 8)}.pdf"`,
    },
  });
}
