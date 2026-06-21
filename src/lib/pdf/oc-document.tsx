import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { SIZES } from "@/lib/order-constants";
import { OC_LABELS, type PaymentTerms, type PdfLang } from "./labels";
import { computeOcTotals } from "./oc-data";

type SizeQty = { size: string; quantity: number };
type OrderItem = {
  category: string | null;
  productId: string;
  sex: string | null;
  modelName: string;
  materialName: string | null;
  color: string | null;
  wholesaleEur: number;
  retailEur: number;
  sizes: SizeQty[];
  memo: string | null;
};

type Props = {
  lang: PdfLang;
  nickname: string;          // top-center brand
  footerLine: string;        // legal entity line at the bottom
  orderNumber: string;
  customerName: string;
  clientName: string | null;
  customerAddressLines: string[];
  customerId: string;
  seasonName: string;
  orderDate: string | null;
  discountRate: number;
  taxRate: number;
  currency: string;            // "EUR" | "JPY" (customers.currency)
  exchangeRate: number | null; // orders.exchange_rate (Season snapshot)
  paymentTerms: PaymentTerms;
  items: OrderItem[];
  versionLabel?: string | null;
  // ── variant: shared layout for OC / Advance / Final ──
  variant?: "oc" | "advance" | "final";
  numberText?: string | null;       // overrides "ORDER #: n" (e.g. "No. DEP-0001")
  bankDetails?: string[] | null;     // shown on advance/final
  paymentDeadline?: string | null;   // shown on advance/final (payment due date)
  issueDate?: string | null;         // shown on advance/final (発行日)
  depositRate?: number;              // advance: advance = total × rate
  depositApplied?: number;           // final: billing-currency deposit to deduct
};

function fmtEur(n: number) {
  return `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtJpy(n: number) {
  return `¥${Math.round(n).toLocaleString("en-US")}`;
}
function sizeLabel(s: string) {
  return s === "Free" ? "F" : s;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.replaceAll("-", "/");
}

// Column widths (A4 usable ≈ 523pt @ 36pt padding)
const W_CAT = 38;
const W_PRICE = 58;
const W_SIZE = 11;
const W_QTY = 18;
const W_TOTAL = 56;
const W_MEMO = 40;

export function OcDocument({
  lang, nickname, footerLine, orderNumber, customerName, clientName, customerAddressLines,
  customerId, seasonName, orderDate, discountRate, taxRate, currency, exchangeRate, paymentTerms, items,
  versionLabel, variant = "oc", numberText, bankDetails, paymentDeadline, issueDate, depositRate, depositApplied,
}: Props) {
  const isInvoice = variant !== "oc";
  const L = OC_LABELS[lang];

  const discountPct = Math.round(discountRate * 100);
  const taxPct = Math.round(taxRate * 100);

  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : null;
  const isJpy = currency === "JPY" && rate !== null;
  const t = computeOcTotals(items, taxRate, isJpy, rate);
  const { totalQty, subtotalRetail, subtotalWholesale, subRetailJpy, taxAmount, totalEur, subWholesaleJpy, taxJpy, totalJpy, billingTotal } = t;
  const fmtBill = (n: number) => (isJpy ? fmtJpy(n) : fmtEur(n));
  const jpyU = (eur: number) => Math.round(eur * (rate as number)); // per-unit/line ¥ (matches computeOcTotals)

  // Title + number per variant
  const title = variant === "advance" ? L.advanceInvoice : variant === "final" ? L.finalInvoice : L.orderConfirmation;
  const numText = numberText ?? `${L.orderNo} ${orderNumber}`;

  // Billing rows after the summary Total + the headline amount due
  const extraRows: { label: string; amount: string; bold?: boolean }[] = [];
  let amountDue = billingTotal;
  if (variant === "advance") {
    const dr = depositRate ?? 0;
    const advanceVal = isJpy ? Math.round(billingTotal * dr) : billingTotal * dr;
    const balanceVal = billingTotal - advanceVal;
    const dPct = Math.round(dr * 100);
    extraRows.push({ label: `${L.advancePayment} (${dPct}%)`, amount: fmtBill(advanceVal), bold: true });
    extraRows.push({ label: `${L.balance} (${100 - dPct}%)`, amount: fmtBill(balanceVal) });
    amountDue = advanceVal;
  } else if (variant === "final") {
    const applied = depositApplied ?? 0;
    // 前払い金充当は内訳として残す。請求額（合計の下）は上部の強調帯に表示するため
    // サマリには重複させない。
    if (applied > 0) extraRows.push({ label: L.lessDeposit, amount: `− ${fmtBill(applied)}` });
    amountDue = billingTotal - applied;
  }

  const cell = { fontSize: 7, color: "#1a1a1a" };
  const muted = { color: "#8a8a8a" };

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: "NotoSansJP", paddingTop: 28, paddingBottom: 48, paddingHorizontal: 28, fontSize: 8, color: "#1a1a1a" }}>
        {/* Top brand */}
        <Text style={{ fontSize: 9, color: "#666", textAlign: "center", marginBottom: 8 }}>{nickname}</Text>
        <View style={{ borderTop: "0.5pt solid #d0d0d0", marginBottom: 10 }} />

        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 14, flexShrink: 0 }}>{title}</Text>
          <Text style={{ marginHorizontal: 10, color: "#d0d0d0", fontSize: 14, flexShrink: 0 }}>|</Text>
          <Text style={{ fontSize: 9, color: "#555", flexShrink: 0 }}>{numText}</Text>
          {versionLabel ? (
            <Text style={{ marginLeft: 8, fontSize: 8, color: "#999" }}>({versionLabel})</Text>
          ) : null}
          {clientName ? (
            <Text style={{ marginLeft: "auto", fontSize: 9, color: "#555" }}>ClientName: {clientName}</Text>
          ) : null}
        </View>
        <View style={{ borderTop: "0.5pt solid #d0d0d0", marginBottom: 12 }} />

        {/* Customer + meta */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ maxWidth: 280 }}>
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 2 }}>{customerName}</Text>
            {customerAddressLines.map((line, i) => (
              <Text key={i} style={{ fontSize: 8, color: "#555" }}>{line}</Text>
            ))}
          </View>
          <View style={{ flexDirection: "row" }}>
            <View style={{ marginRight: 6 }}>
              {isInvoice ? (
                issueDate ? <Text style={{ fontSize: 8, color: "#888" }}>{L.issueDate}</Text> : null
              ) : (
                <Text style={{ fontSize: 8, color: "#888" }}>{L.date}</Text>
              )}
              <Text style={{ fontSize: 8, color: "#888" }}>{L.season}</Text>
              <Text style={{ fontSize: 8, color: "#888" }}>{L.customerId}</Text>
              {isInvoice ? <Text style={{ fontSize: 8, color: "#888" }}>{L.currency}</Text> : null}
            </View>
            <View>
              {isInvoice ? (
                issueDate ? <Text style={{ fontSize: 8, color: "#333" }}>: {issueDate}</Text> : null
              ) : (
                <Text style={{ fontSize: 8, color: "#333" }}>: {fmtDate(orderDate)}</Text>
              )}
              <Text style={{ fontSize: 8, color: "#333" }}>: {seasonName}</Text>
              <Text style={{ fontSize: 8, color: "#333" }}>: {customerId}</Text>
              {isInvoice ? <Text style={{ fontSize: 8, color: "#333" }}>: {currency}</Text> : null}
            </View>
          </View>
        </View>

        {/* Prominent amount-due + deadline band (invoices) */}
        {isInvoice ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f3f3f3", borderRadius: 4, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 8, color: "#888", marginBottom: 1 }}>{L.paymentDeadline}</Text>
              <Text style={{ fontSize: 12, fontWeight: "bold" }}>{paymentDeadline ?? "—"}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 8, color: "#888", marginBottom: 1 }}>{L.balanceDue}</Text>
              <Text style={{ fontSize: 16, fontWeight: "bold" }}>{fmtBill(amountDue)}</Text>
            </View>
          </View>
        ) : null}

        {/* Product table */}
        <View>
          {/* Header */}
          <View style={{ flexDirection: "row", backgroundColor: "#3a3a3a", paddingVertical: 3, paddingHorizontal: 4 }}>
            <Text style={{ width: W_CAT, fontSize: 6, color: "#fff" }}>{L.colCategory}{"\n"}{L.colId}</Text>
            <Text style={{ flex: 1, fontSize: 6, color: "#fff" }}>{L.colItem}</Text>
            <Text style={{ width: W_PRICE, fontSize: 6, color: "#fff", textAlign: "right" }}>{L.colWholesale}{"\n"}{L.colRetail}</Text>
            {SIZES.map((s) => (
              <Text key={s} style={{ width: W_SIZE, fontSize: 6, color: "#fff", textAlign: "center" }}>{sizeLabel(s)}</Text>
            ))}
            <Text style={{ width: W_QTY, fontSize: 6, color: "#fff", textAlign: "right" }}>{L.colQty}</Text>
            <Text style={{ width: W_TOTAL, fontSize: 6, color: "#fff", textAlign: "right" }}>{L.colWhsleTotal}</Text>
            <Text style={{ width: W_TOTAL, fontSize: 6, color: "#fff", textAlign: "right" }}>{L.colRetailTotal}</Text>
            <Text style={{ width: W_MEMO, fontSize: 6, color: "#fff", textAlign: "right" }}>{L.colMemo}</Text>
          </View>

          {/* Rows */}
          {items.map((item, idx) => {
            const qty = item.sizes.reduce((a, b) => a + b.quantity, 0);
            return (
              <View key={idx} style={{ flexDirection: "row", borderBottom: "0.5pt solid #eee", paddingVertical: 4, paddingHorizontal: 4, alignItems: "flex-start" }}>
                {/* category / id / sex */}
                <View style={{ width: W_CAT }}>
                  <Text style={{ fontSize: 6, ...muted }}>{item.category ?? "—"}</Text>
                  <Text style={{ fontSize: 7 }}>{item.productId}</Text>
                  {item.sex ? <Text style={{ fontSize: 6, ...muted }}>{item.sex}</Text> : null}
                </View>
                {/* item */}
                <View style={{ flex: 1, paddingRight: 4 }}>
                  <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>{item.modelName}</Text>
                  <Text style={{ fontSize: 6, ...muted }}>
                    {[item.materialName, item.color].filter(Boolean).join(" | ") || "—"}
                  </Text>
                </View>
                {/* wholesale(下代) / retail(上代) unit — JPY shows ¥ + € */}
                <View style={{ width: W_PRICE }}>
                  {isJpy ? (
                    <>
                      <Text style={{ ...cell, textAlign: "right" }}>{fmtJpy(jpyU(item.wholesaleEur))}</Text>
                      <Text style={{ fontSize: 5.5, ...muted, textAlign: "right", marginBottom: 1.5 }}>{fmtEur(item.wholesaleEur)}</Text>
                      <Text style={{ ...cell, textAlign: "right" }}>{fmtJpy(jpyU(item.retailEur))}</Text>
                      <Text style={{ fontSize: 5.5, ...muted, textAlign: "right" }}>{fmtEur(item.retailEur)}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ ...cell, textAlign: "right" }}>{fmtEur(item.wholesaleEur)}</Text>
                      <Text style={{ fontSize: 7, ...muted, textAlign: "right" }}>{fmtEur(item.retailEur)}</Text>
                    </>
                  )}
                </View>
                {/* sizes */}
                {SIZES.map((s) => {
                  const q = item.sizes.find((sz) => sz.size === s)?.quantity ?? 0;
                  return (
                    <Text key={s} style={{ width: W_SIZE, ...cell, textAlign: "center" }}>{q > 0 ? q : ""}</Text>
                  );
                })}
                {/* qty */}
                <Text style={{ width: W_QTY, ...cell, textAlign: "right", fontWeight: "bold" }}>{qty}</Text>
                {/* 下代合計 / 上代合計 — JPY shows ¥ + € */}
                <View style={{ width: W_TOTAL }}>
                  {isJpy ? (
                    <>
                      <Text style={{ ...cell, textAlign: "right" }}>{fmtJpy(jpyU(item.wholesaleEur) * qty)}</Text>
                      <Text style={{ fontSize: 5.5, ...muted, textAlign: "right" }}>{fmtEur(item.wholesaleEur * qty)}</Text>
                    </>
                  ) : (
                    <Text style={{ ...cell, textAlign: "right" }}>{fmtEur(item.wholesaleEur * qty)}</Text>
                  )}
                </View>
                <View style={{ width: W_TOTAL }}>
                  {isJpy ? (
                    <>
                      <Text style={{ ...cell, textAlign: "right" }}>{fmtJpy(jpyU(item.retailEur) * qty)}</Text>
                      <Text style={{ fontSize: 5.5, ...muted, textAlign: "right" }}>{fmtEur(item.retailEur * qty)}</Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 7, ...muted, textAlign: "right" }}>{fmtEur(item.retailEur * qty)}</Text>
                  )}
                </View>
                {/* memo */}
                <Text style={{ width: W_MEMO, fontSize: 6, ...muted, textAlign: "right" }}>{item.memo ?? ""}</Text>
              </View>
            );
          })}

          {/* Grand total qty / amounts strip */}
          <View style={{ flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4 }}>
            <View style={{ width: W_CAT + W_PRICE }} />
            <View style={{ flex: 1 }} />
            {SIZES.map((s) => <View key={s} style={{ width: W_SIZE }} />)}
            <Text style={{ width: W_QTY, fontSize: 8, textAlign: "right", fontWeight: "bold" }}>{totalQty}</Text>
            <View style={{ width: W_TOTAL }}>
              <Text style={{ fontSize: 7, textAlign: "right", ...muted }}>{isJpy ? fmtJpy(subWholesaleJpy) : fmtEur(subtotalWholesale)}</Text>
              {isJpy ? <Text style={{ fontSize: 5.5, textAlign: "right", ...muted }}>{fmtEur(subtotalWholesale)}</Text> : null}
            </View>
            <View style={{ width: W_TOTAL }}>
              <Text style={{ fontSize: 7, textAlign: "right", ...muted }}>{isJpy ? fmtJpy(subRetailJpy) : fmtEur(subtotalRetail)}</Text>
              {isJpy ? <Text style={{ fontSize: 5.5, textAlign: "right", ...muted }}>{fmtEur(subtotalRetail)}</Text> : null}
            </View>
            <View style={{ width: W_MEMO }} />
          </View>
        </View>

        {/* Payment terms + summary */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
          {/* Payment Term block */}
          <View style={{ width: 300 }}>
            {paymentTerms ? (
              <>
                <View style={{ backgroundColor: "#e9e9e9", paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 8, color: "#555" }}>{paymentTerms.label}</Text>
                </View>
                {paymentTerms.lines.map((line, i) => (
                  <Text key={i} style={{ fontSize: 7, color: "#444", marginBottom: 1.5 }}>{line}</Text>
                ))}
              </>
            ) : null}
          </View>

          {/* Summary table — JPY shows ¥ (primary) + € (secondary) */}
          <View style={{ width: 200 }}>
            <SummaryRow label={L.subtotalRetail} mid={String(totalQty)} amount={isJpy ? fmtJpy(subRetailJpy) : fmtEur(subtotalRetail)} sub={isJpy ? fmtEur(subtotalRetail) : undefined} />
            <SummaryRow label={L.subtotalWholesale} mid={`${discountPct}%`} amount={isJpy ? fmtJpy(subWholesaleJpy) : fmtEur(subtotalWholesale)} sub={isJpy ? fmtEur(subtotalWholesale) : undefined} />
            <SummaryRow label={L.tax} mid={`${taxPct}%`} amount={isJpy ? fmtJpy(taxJpy) : fmtEur(taxAmount)} />
            <SummaryRow label={L.total} mid="" amount={isJpy ? fmtJpy(totalJpy) : fmtEur(totalEur)} bold />
            {extraRows.map((r, i) => (
              <SummaryRow key={i} label={r.label} mid="" amount={r.amount} bold={r.bold} />
            ))}
          </View>
        </View>

        {/* Bank details (advance / final) */}
        {variant !== "oc" && bankDetails ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ backgroundColor: "#e9e9e9", paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: "#555" }}>{L.bankDetails}</Text>
            </View>
            {bankDetails.map((line, i) => (
              <Text key={i} style={{ fontSize: 7, color: "#444", marginBottom: 1.5 }}>{line}</Text>
            ))}
          </View>
        ) : null}

        {/* Footer */}
        <View style={{ position: "absolute", bottom: 22, left: 28, right: 28 }} fixed>
          <Text style={{ fontSize: 6.5, color: "#999", textAlign: "center" }}>{footerLine}</Text>
        </View>
      </Page>
    </Document>
  );
}

function SummaryRow({ label, mid, amount, sub, bold }: { label: string; mid: string; amount: string; sub?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", borderBottom: "0.5pt solid #ddd", borderLeft: "0.5pt solid #ddd", borderRight: "0.5pt solid #ddd" }}>
      <Text style={{ flex: 1, fontSize: 8, paddingVertical: 3, paddingHorizontal: 5, backgroundColor: "#f5f5f5", fontWeight: bold ? "bold" : "normal" }}>{label}</Text>
      <Text style={{ width: 34, fontSize: 8, paddingVertical: 3, paddingHorizontal: 4, textAlign: "center", color: "#666" }}>{mid}</Text>
      <View style={{ width: 78, paddingVertical: 3, paddingHorizontal: 5 }}>
        <Text style={{ fontSize: 8, textAlign: "right", fontWeight: bold ? "bold" : "normal" }}>{amount}</Text>
        {sub ? <Text style={{ fontSize: 6, textAlign: "right", color: "#999" }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
