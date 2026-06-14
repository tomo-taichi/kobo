"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { OcDocument } from "@/lib/pdf/oc-document";
import { DepositInvoiceDocument } from "@/lib/pdf/deposit-invoice-document";
import { FinalInvoiceDocument } from "@/lib/pdf/final-invoice-document";
import { CommercialInvoiceDocument } from "@/lib/pdf/commercial-invoice-document";
import { getLang, buildPaymentTerms, bankDetailLines } from "@/lib/pdf/labels";
import { buildOcProps } from "@/lib/pdf/oc-data";
import { beginVersion, finalizeVersion } from "@/lib/pdf/document-log";

export type SavePdfResult = { url: string } | { error: string };

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

async function resolveCompany(supabase: any, lang: "en" | "ja") {
  const { data } = await supabase
    .from("company_settings")
    .select("name_en, name_ja, address_en, address_ja, nickname, bank_wise_eu, bank_rakuten_jp")
    .single();
  return {
    name: lang === "ja" ? (data?.name_ja ?? "taichimurakami") : (data?.name_en ?? "taichimurakami"),
    address: lang === "ja" ? (data?.address_ja ?? "") : (data?.address_en ?? ""),
    nickname: data?.nickname ?? "taichimurakami",
    bankWiseEu: data?.bank_wise_eu ?? null,
    bankRakutenJp: data?.bank_rakuten_jp ?? null,
  };
}

async function upload(supabase: any, orderId: string, key: string, buffer: Buffer): Promise<string> {
  const path = `orders/${orderId}/${key}.pdf`;
  await supabase.storage.from("order-documents").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  const { data } = supabase.storage.from("order-documents").getPublicUrl(path);
  return data.publicUrl;
}

export async function saveOcPdf(orderId: string): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const props = await buildOcProps(supabase, orderId);
  if (!props) return { error: "Order not found" };

  const v = await beginVersion(supabase, orderId, "oc");
  (props as any).versionLabel = v.versionLabel;

  try {
    const buffer = await renderToBuffer(React.createElement(OcDocument, props as any) as any);

    const url = await upload(supabase, orderId, `OC_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });
    await supabase.from("orders").update({ pdf_oc_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

export async function saveDepositPdf(orderId: string): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const orderResult = await supabase
    .from("orders")
    .select("order_date, currency_type, deposit_rate, deposit_amount_eur, deposit_amount_jpy, invoice_count, customers(name, group_type, currency, bank, deposit_terms, billing_company, billing_address, billing_city, billing_country), seasons(name)")
    .eq("id", orderId)
    .single();

  const order: any = orderResult.data;
  if (!order) return { error: "Order not found" };

  const lang = getLang(order.customers?.group_type);
  const company = await resolveCompany(supabase, lang);
  const paymentTerms = buildPaymentTerms(
    order.customers?.group_type,
    order.customers?.deposit_terms === "Deposit_and_Production",
    Math.round(Number(order.deposit_rate ?? 0) * 100),
    company.nickname,
  );
  const bankDetails = bankDetailLines(order.customers?.bank, company.bankWiseEu, company.bankRakutenJp);

  const v = await beginVersion(supabase, orderId, "deposit");

  try {
    const buffer = await renderToBuffer(React.createElement(DepositInvoiceDocument, {
      lang,
      company,
      customerName: order.customers?.billing_company || order.customers?.name || "—",
      customerAddress: buildCustomerAddress(order.customers),
      seasonName: order.seasons?.name ?? "—",
      orderDate: order.order_date,
      currency: order.customers?.currency === "JPY" ? "JPY" : "EUR",
      depositAmountEur: order.deposit_amount_eur ? Number(order.deposit_amount_eur) : null,
      depositAmountJpy: order.deposit_amount_jpy ? Number(order.deposit_amount_jpy) : null,
      invoiceCount: order.invoice_count ?? 0,
      paymentTerms,
      bankDetails,
      paymentDeadline: null,
      versionLabel: v.versionLabel,
    }) as any);

    const url = await upload(supabase, orderId, `Deposit_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });
    await supabase.from("orders").update({ pdf_deposit_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

export async function saveFinalInvoicePdf(orderId: string): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const [orderResult, itemsResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, currency_type, exchange_rate, deposit_rate, invoice_count, customers(name, group_type, currency, bank, deposit_terms, billing_company, billing_address, billing_city, billing_country), seasons(name)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("order_items")
      .select("customer_wholesale_eur, products(product_number, product_category, model_name, name, color), order_item_sizes(size, quantity)")
      .eq("order_id", orderId)
      .eq("is_flagged_invoice", true),
  ]);

  const order: any = orderResult.data;
  if (!order) return { error: "Order not found" };

  const lang = getLang(order.customers?.group_type);
  const company = await resolveCompany(supabase, lang);
  const paymentTerms = buildPaymentTerms(
    order.customers?.group_type,
    order.customers?.deposit_terms === "Deposit_and_Production",
    Math.round(Number(order.deposit_rate ?? 0) * 100),
    company.nickname,
  );
  const bankDetails = bankDetailLines(order.customers?.bank, company.bankWiseEu, company.bankRakutenJp);
  const v = await beginVersion(supabase, orderId, "final");

  const items = (itemsResult.data ?? []).map((item: any) => ({
    productId: fmtId(item.products?.product_number),
    productCategory: item.products?.product_category ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    color: item.products?.color ?? null,
    customerWholesaleEur: Number(item.customer_wholesale_eur),
    sizes: (item.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
  }));

  try {
    const buffer = await renderToBuffer(React.createElement(FinalInvoiceDocument, {
      lang,
      company,
      customerName: order.customers?.billing_company || order.customers?.name || "—",
      customerAddress: buildCustomerAddress(order.customers),
      seasonName: order.seasons?.name ?? "—",
      orderDate: order.order_date,
      currency: order.customers?.currency === "JPY" ? "JPY" : "EUR",
      exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
      invoiceCount: order.invoice_count ?? 1,
      items,
      paymentTerms,
      bankDetails,
      depositAppliedEur: null,
      versionLabel: v.versionLabel,
    }) as any);

    const url = await upload(supabase, orderId, `FinalInvoice_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });
    await supabase.from("orders").update({ pdf_final_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

export async function saveCommercialPdf(orderId: string, isOverseas: boolean): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const orderResult = await supabase
    .from("orders")
    .select("order_date, currency_type, exchange_rate, customers(name, group_type, billing_company, billing_address, billing_city, billing_country), seasons(name)")
    .eq("id", orderId)
    .single();

  const order: any = orderResult.data;
  if (!order) return { error: "Order not found" };

  const lang = getLang(order.customers?.group_type);
  const company = await resolveCompany(supabase, lang);
  const v = await beginVersion(supabase, orderId, isOverseas ? "commercial" : "delivery");

  const flagField = isOverseas ? "is_flagged_invoice" : "is_flagged_delivery";
  const itemsResult = await supabase
    .from("order_items")
    .select("customer_wholesale_eur, products(product_number, product_category, model_name, name, color), order_item_sizes(size, quantity), product_materials(materials(name))")
    .eq("order_id", orderId)
    .eq(flagField, true);

  const items = (itemsResult.data ?? []).map((item: any) => ({
    productId: fmtId(item.products?.product_number),
    productCategory: item.products?.product_category ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    color: item.products?.color ?? null,
    customerWholesaleEur: Number(item.customer_wholesale_eur),
    sizes: (item.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
    materials: (item.product_materials ?? []).map((pm: any) => pm.materials?.name ?? "").filter(Boolean),
  }));

  try {
    const buffer = await renderToBuffer(React.createElement(CommercialInvoiceDocument, {
      lang,
      company,
      customerName: order.customers?.billing_company || order.customers?.name || "—",
      customerAddress: buildCustomerAddress(order.customers),
      seasonName: order.seasons?.name ?? "—",
      orderDate: order.order_date,
      currencyType: order.currency_type,
      exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
      isOverseas,
      items,
      versionLabel: v.versionLabel,
    }) as any);

    const key = isOverseas ? "CommercialInvoice" : "DeliveryNote";
    const url = await upload(supabase, orderId, `${key}_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });
    await supabase.from("orders").update({ pdf_commercial_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}
