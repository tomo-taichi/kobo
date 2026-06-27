"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureFonts } from "@/lib/pdf/fonts";
import { OcDocument } from "@/lib/pdf/oc-document";
import { CommercialInvoiceDocument } from "@/lib/pdf/commercial-invoice-document";
import { DeliveryNoteDocument } from "@/lib/pdf/delivery-note-document";
import { getLang, OC_LABELS } from "@/lib/pdf/labels";
import { buildOcProps, computeOcTotals, buildDeliveryNoteProps } from "@/lib/pdf/oc-data";
import { beginVersion, finalizeVersion, upsertDocumentDebit } from "@/lib/pdf/document-log";

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
    const ocT = computeOcTotals((props as any).items, (props as any).taxRate, (props as any).currency === "JPY", (props as any).exchangeRate);
    await supabase.from("order_documents").update({ total_qty: ocT.totalQty, total_amount: ocT.billingTotal }).eq("id", v.documentId);
    await supabase.from("orders").update({ pdf_oc_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

// Advance Invoice (internally doc_type "deposit") — full OC body + advance/balance + bank + deadline
export async function saveDepositPdf(orderId: string, paymentDeadline?: string | null): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const props: any = await buildOcProps(supabase, orderId);
  if (!props) return { error: "Order not found" };

  const isJpy = props.currency === "JPY";
  const deadlineDisplay = paymentDeadline ? paymentDeadline.replaceAll("-", "/") : null;
  const v = await beginVersion(supabase, orderId, "deposit");

  // Advance amount (= what's billed now) computed the same way the PDF renders it
  const t = computeOcTotals(props.items, props.taxRate, isJpy, props.exchangeRate);
  const advance = isJpy
    ? Math.round(t.billingTotal * props.depositRate)
    : t.billingTotal * props.depositRate;

  try {
    const buffer = await renderToBuffer(React.createElement(OcDocument, {
      ...props,
      variant: "advance",
      numberText: `${OC_LABELS[props.lang as "en" | "ja"].invoiceNo} DEP-${String(props.invoiceCount + 1).padStart(4, "0")}`,
      paymentDeadline: deadlineDisplay,
      issueDate: issueDateJst(),
      versionLabel: v.versionLabel,
    }) as any);

    const url = await upload(supabase, orderId, `Advance_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });
    await supabase.from("order_documents")
      .update({ total_qty: t.totalQty, total_amount: t.billingTotal, ...(paymentDeadline ? { deposit_deadline: paymentDeadline } : {}) })
      .eq("id", v.documentId);

    await upsertDocumentDebit(supabase, {
      documentId: v.documentId,
      orderId,
      customerId: props.customerIdRaw,
      category: "deposit",
      amount: advance,
      currency: isJpy ? "JPY" : "EUR",
      note: `Advance Invoice ${v.versionLabel}`,
    });

    await supabase.from("orders").update({ pdf_deposit_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    if (props.customerIdRaw) revalidatePath(`/customers/${props.customerIdRaw}/payments`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

export type BatchOpts = { mode?: "new" | "revise"; documentId?: string | null; itemIds?: string[] | null; paymentDeadline?: string | null; depositPaid?: boolean };

// Generation date (issue date) in JST, formatted YYYY/MM/DD
function issueDateJst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).replaceAll("-", "/");
}

// Final Invoice — full OC body + tax, less paid-deposit (pool), Balance Due. Batch-aware.
export async function saveFinalInvoicePdf(orderId: string, opts: BatchOpts = {}): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  const props: any = await buildOcProps(supabase, orderId);
  if (!props) return { error: "Order not found" };

  const isJpy = props.currency === "JPY";

  // Selected batch items (fallback to all items if no explicit selection)
  const selectedIds: string[] | null = opts.itemIds && opts.itemIds.length > 0 ? opts.itemIds : null;
  const batchItems = selectedIds
    ? props.items.filter((i: any) => selectedIds.includes(i.id))
    : props.items;
  if (!batchItems.length) return { error: "No items selected for this invoice" };

  const v = await beginVersion(supabase, orderId, "final", {
    documentId: opts.mode === "revise" ? opts.documentId : null,
    forceNew: opts.mode !== "revise",
    itemIds: batchItems.map((i: any) => i.id),
  });

  // Batch total (tax-inclusive) in billing currency
  const t = computeOcTotals(batchItems, props.taxRate, isJpy, props.exchangeRate);
  const billingTotal = t.billingTotal;

  // Deduct the paid deposit when confirmed via the popup: deposit_rate (30%) of
  // THIS batch's total. Each batch deducts its own 30%, so across all batches the
  // deduction sums to 30% of the order total (= the deposit). No deduction if "No".
  const depositApplied = opts.depositPaid
    ? (isJpy ? Math.round(billingTotal * props.depositRate) : billingTotal * props.depositRate)
    : 0;
  const balanceDue = billingTotal - depositApplied;

  try {
    const dueDisplay = opts.paymentDeadline ? opts.paymentDeadline.replaceAll("-", "/") : null;
    const buffer = await renderToBuffer(React.createElement(OcDocument, {
      ...props,
      items: batchItems,
      variant: "final",
      numberText: `${OC_LABELS[props.lang as "en" | "ja"].invoiceNo} INV-${String(props.invoiceCount).padStart(4, "0")}`,
      depositApplied,
      issueDate: issueDateJst(),
      paymentDeadline: dueDisplay,
      versionLabel: v.versionLabel,
    }) as any);

    const url = await upload(supabase, orderId, `FinalInvoice_b${v.seqNo}_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });

    await supabase.from("order_documents")
      .update({ deposit_applied: depositApplied, total_qty: t.totalQty, total_amount: t.billingTotal, ...(opts.paymentDeadline ? { deposit_deadline: opts.paymentDeadline } : {}) })
      .eq("id", v.documentId);
    // Auto-tick "invoiced" for the included items (status source)
    await supabase.from("order_items").update({ is_flagged_invoice: true }).in("id", batchItems.map((i: any) => i.id));
    await upsertDocumentDebit(supabase, {
      documentId: v.documentId,
      orderId,
      customerId: props.customerIdRaw,
      category: "balance",
      amount: balanceDue,
      currency: isJpy ? "JPY" : "EUR",
      note: `Final Invoice batch ${v.seqNo} ${v.versionLabel}`,
    });

    await supabase.from("orders").update({ pdf_final_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    if (props.customerIdRaw) revalidatePath(`/customers/${props.customerIdRaw}/payments`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}

export async function saveCommercialPdf(orderId: string, isOverseas: boolean, opts: BatchOpts = {}): Promise<SavePdfResult> {
  ensureFonts();
  const supabase = await createClient();

  // Domestic Delivery Note (納品書) — dedicated Japanese all-¥ layout
  if (!isOverseas) {
    const dn: any = await buildDeliveryNoteProps(supabase, orderId, opts.itemIds);
    if (!dn) return { error: "Order not found" };
    if (dn.itemRowIds.length === 0) return { error: "No items selected" };

    const v = await beginVersion(supabase, orderId, "delivery", {
      documentId: opts.mode === "revise" ? opts.documentId : null,
      forceNew: opts.mode !== "revise",
      itemIds: dn.itemRowIds,
    });

    try {
      const buffer = await renderToBuffer(React.createElement(DeliveryNoteDocument, { ...dn, versionLabel: v.versionLabel }) as any);
      const url = await upload(supabase, orderId, `DeliveryNote_b${v.seqNo}_${v.versionLabel}`, buffer as unknown as Buffer);
      await finalizeVersion(supabase, { ...v, fileUrl: url });

      let totalQty = 0, wholesaleJpy = 0;
      for (const it of dn.items) {
        const q = it.sizes.reduce((a: number, b: any) => a + b.quantity, 0);
        totalQty += q;
        wholesaleJpy += it.whsleJpy * q;
      }
      const totalAmount = wholesaleJpy + Math.round(wholesaleJpy * dn.taxRate);
      await supabase.from("order_documents").update({ total_qty: totalQty, total_amount: totalAmount }).eq("id", v.documentId);
      await supabase.from("order_items").update({ is_flagged_delivery: true }).in("id", dn.itemRowIds);
      await supabase.from("orders").update({ pdf_commercial_url: url }).eq("id", orderId);
      revalidatePath(`/orders/${orderId}/documents`);
      return { url };
    } catch (e: any) {
      return { error: e?.message ?? "PDF generation failed" };
    }
  }

  const orderResult = await supabase
    .from("orders")
    .select("order_date, currency_type, exchange_rate, customers(name, group_type, currency, billing_company, billing_address, billing_city, billing_country), seasons(name)")
    .eq("id", orderId)
    .single();

  const order: any = orderResult.data;
  if (!order) return { error: "Order not found" };

  const lang = getLang(order.customers?.currency);
  const company = await resolveCompany(supabase, lang);

  // Selected batch items (fallback to flag if no explicit selection)
  const flagField = isOverseas ? "is_flagged_invoice" : "is_flagged_delivery";
  let itemsQuery = supabase
    .from("order_items")
    .select("id, customer_wholesale_eur, products(product_number, product_category, model_name, name, color, product_materials(materials(name))), product_colors(material_colors(color)), order_item_sizes(size, quantity)")
    .eq("order_id", orderId);
  if (opts.itemIds && opts.itemIds.length > 0) {
    itemsQuery = itemsQuery.in("id", opts.itemIds);
  } else {
    itemsQuery = itemsQuery.eq(flagField, true);
  }
  const { data: itemRows } = await itemsQuery;
  if (!itemRows || itemRows.length === 0) return { error: "No items selected" };

  const docType = isOverseas ? "commercial" : "delivery";
  const v = await beginVersion(supabase, orderId, docType, {
    documentId: opts.mode === "revise" ? opts.documentId : null,
    forceNew: opts.mode !== "revise",
    itemIds: (itemRows as any[]).map((r) => r.id),
  });

  const items = (itemRows as any[]).map((item: any) => ({
    productId: fmtId(item.products?.product_number),
    productCategory: item.products?.product_category ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    color: item.product_colors?.material_colors?.color ?? item.products?.color ?? null,
    customerWholesaleEur: Number(item.customer_wholesale_eur),
    sizes: (item.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
    materials: (item.products?.product_materials ?? []).map((pm: any) => pm.materials?.name ?? "").filter(Boolean),
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
    const url = await upload(supabase, orderId, `${key}_b${v.seqNo}_${v.versionLabel}`, buffer as unknown as Buffer);
    await finalizeVersion(supabase, { ...v, fileUrl: url });

    // Goods total snapshot (WS value in billing currency, no tax) + qty
    const isJpy = order.customers?.currency === "JPY";
    const rate = order.exchange_rate ? Number(order.exchange_rate) : null;
    const totalQty = items.reduce((s: number, i: any) => s + i.sizes.reduce((a: number, b: any) => a + b.quantity, 0), 0);
    const wsEur = items.reduce((s: number, i: any) => s + i.customerWholesaleEur * i.sizes.reduce((a: number, b: any) => a + b.quantity, 0), 0);
    const totalAmount = isJpy && rate ? Math.floor((wsEur * rate) / 1000) * 1000 : wsEur;
    await supabase.from("order_documents").update({ total_qty: totalQty, total_amount: totalAmount }).eq("id", v.documentId);
    // Auto-tick "delivered" for the included items (status source)
    await supabase.from("order_items").update({ is_flagged_delivery: true }).in("id", (itemRows as any[]).map((r) => r.id));

    await supabase.from("orders").update({ pdf_commercial_url: url }).eq("id", orderId);
    revalidatePath(`/orders/${orderId}/documents`);
    return { url };
  } catch (e: any) {
    return { error: e?.message ?? "PDF generation failed" };
  }
}
