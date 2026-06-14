import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { base } from "./styles";
import { SIZES } from "@/lib/order-constants";
import { LABELS, type PdfLang, type CompanyInfo, type PaymentTerms } from "./labels";

type SizeQty = { size: string; quantity: number };
type OrderItem = {
  productId: string;
  productCategory: string | null;
  modelName: string;
  color: string | null;
  customerWholesaleEur: number;
  sizes: SizeQty[];
};

type Props = {
  lang: PdfLang;
  company: CompanyInfo;
  customerName: string;
  customerAddress: string;
  seasonName: string;
  orderDate: string | null;
  currency: string;               // "EUR" | "JPY" (customers.currency)
  exchangeRate: number | null;    // orders.exchange_rate
  invoiceCount: number;
  items: OrderItem[];
  paymentTerms: PaymentTerms;
  bankDetails: string[] | null;
  versionLabel?: string | null;
  // Phase 5 (deposit deduction) — null until wired
  depositAppliedEur?: number | null;
};

function fmtEur(n: number) {
  return `€ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtJpy(n: number) {
  return `¥ ${Math.round(n).toLocaleString("en-US")}`;
}

export function FinalInvoiceDocument({
  lang, company, customerName, customerAddress, seasonName, orderDate,
  currency, exchangeRate, invoiceCount, items, paymentTerms, bankDetails, versionLabel,
  depositAppliedEur,
}: Props) {
  const L = LABELS[lang];

  const subtotalEur = items.reduce((s, i) => {
    const qty = i.sizes.reduce((a, b) => a + b.quantity, 0);
    return s + i.customerWholesaleEur * qty;
  }, 0);

  const depositEur = depositAppliedEur ?? 0;
  const balanceEur = subtotalEur - depositEur;

  // JPY customers: only the final billed amount converts to ¥ (floor 1,000);
  // the item table & € subtotal stay in €.
  const rate = exchangeRate && exchangeRate > 0 ? exchangeRate : null;
  const isJpy = currency === "JPY" && rate !== null;
  const toJpy = (eur: number) => Math.floor((eur * (rate as number)) / 1000) * 1000;

  return (
    <Document>
      <Page size="A4" style={{ ...base.page, paddingBottom: 60 }}>
        {/* Company header */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "bold" }}>{company.name}</Text>
          {company.address ? (
            <Text style={[base.muted, { fontSize: 8 }]}>{company.address}</Text>
          ) : null}
        </View>

        <View style={base.divider} />

        {/* Title */}
        <View style={{ marginBottom: 10, marginTop: 6 }}>
          <Text style={base.title}>{L.finalInvoice}</Text>
          <Text style={[base.muted, { fontSize: 8 }]}>
            {L.invoiceNo} INV-{String(invoiceCount).padStart(4, "0")}
            {versionLabel ? `  (${versionLabel})` : ""}
          </Text>
        </View>

        {/* Order info */}
        <View style={[base.section, { marginBottom: 10 }]}>
          <View style={base.row}>
            <Text style={base.label}>{L.to}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold", fontSize: 9 }}>{customerName}</Text>
              {customerAddress ? (
                <Text style={[base.muted, { fontSize: 8 }]}>{customerAddress}</Text>
              ) : null}
            </View>
          </View>
          <View style={base.row}>
            <Text style={base.label}>{L.season}</Text>
            <Text style={base.value}>{seasonName}</Text>
          </View>
          <View style={base.row}>
            <Text style={base.label}>{L.date}</Text>
            <Text style={base.value}>{orderDate ?? "—"}</Text>
          </View>
        </View>

        <View style={base.divider} />

        {/* Product table — EUR price list */}
        <View style={base.table}>
          <View style={base.tableHeader}>
            <Text style={[base.th, { width: 42 }]}>{L.colId}</Text>
            <Text style={[base.th, { width: 58 }]}>{L.colCategory}</Text>
            <Text style={[base.th, { flex: 1 }]}>{L.colProduct}</Text>
            <Text style={[base.th, { width: 72 }]}>{L.colSizes}</Text>
            <Text style={[base.th, { width: 60, textAlign: "right" }]}>{L.unitPrice} EUR</Text>
            <Text style={[base.th, { width: 22, textAlign: "right" }]}>{L.colQty}</Text>
            <Text style={[base.th, { width: 66, textAlign: "right" }]}>{L.colTotal}</Text>
          </View>
          {items.map((item, idx) => {
            const totalQty = item.sizes.reduce((a, b) => a + b.quantity, 0);
            const lineTotalEur = item.customerWholesaleEur * totalQty;
            const sizeBreakdown = SIZES.filter((s) => {
              const e = item.sizes.find((sz) => sz.size === s);
              return e && e.quantity > 0;
            }).map((s) => {
              const q = item.sizes.find((sz) => sz.size === s)?.quantity ?? 0;
              return `${s}:${q}`;
            }).join(" ");
            return (
              <View key={idx} style={base.tableRow}>
                <Text style={[base.td, base.muted, { width: 42, fontSize: 7 }]}>{item.productId}</Text>
                <Text style={[base.td, base.muted, { width: 58, fontSize: 7 }]}>{item.productCategory ?? "—"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[base.td, { fontSize: 9 }]}>{item.modelName}</Text>
                  {item.color ? (
                    <Text style={[base.td, base.muted, { fontSize: 7 }]}>{item.color}</Text>
                  ) : null}
                </View>
                <Text style={[base.td, { width: 72, fontSize: 7 }]}>{sizeBreakdown || "—"}</Text>
                <Text style={[base.td, base.right, { width: 60, fontSize: 7 }]}>{fmtEur(item.customerWholesaleEur)}</Text>
                <Text style={[base.td, base.right, { width: 22, fontSize: 8 }]}>{totalQty}</Text>
                <Text style={[base.td, base.right, { width: 66, fontSize: 7 }]}>{fmtEur(lineTotalEur)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals — € subtotal; JPY customers also show ¥ final total */}
        <View style={{ alignItems: "flex-end", marginTop: 4 }}>
          <View style={{ width: 230 }}>
            <View style={base.divider} />
            <View style={[base.row, { justifyContent: "space-between" }]}>
              <Text style={base.muted}>{L.subtotalWs}</Text>
              <Text>{fmtEur(subtotalEur)}</Text>
            </View>
            {depositEur > 0 && (
              <View style={[base.row, { justifyContent: "space-between" }]}>
                <Text style={base.muted}>{lang === "ja" ? "前払い金充当" : "Less: Deposit"}</Text>
                <Text>− {fmtEur(depositEur)}</Text>
              </View>
            )}
            <View style={[base.row, { justifyContent: "space-between", borderTop: "0.5pt solid #ccc", paddingTop: 3, marginTop: 2 }]}>
              <Text style={{ fontWeight: "bold" }}>{depositEur > 0 ? L.balance : L.total}</Text>
              <Text style={{ fontWeight: "bold" }}>
                {isJpy ? fmtJpy(toJpy(balanceEur)) : fmtEur(balanceEur)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Term */}
        {paymentTerms ? (
          <View style={{ marginTop: 16 }}>
            <View style={{ backgroundColor: "#e9e9e9", paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: "#555" }}>{paymentTerms.label}</Text>
            </View>
            {paymentTerms.lines.map((line, i) => (
              <Text key={i} style={{ fontSize: 7, color: "#444", marginBottom: 1.5 }}>{line}</Text>
            ))}
          </View>
        ) : null}

        {/* Bank Details */}
        {bankDetails ? (
          <View style={{ marginTop: 10 }}>
            <View style={{ backgroundColor: "#e9e9e9", paddingVertical: 3, paddingHorizontal: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 8, color: "#555" }}>BANK DETAILS:</Text>
            </View>
            {bankDetails.map((line, i) => (
              <Text key={i} style={{ fontSize: 7, color: "#444", marginBottom: 1.5 }}>{line}</Text>
            ))}
          </View>
        ) : null}

        {/* Footer */}
        <View style={{ position: "absolute", bottom: 28, left: 36, right: 36, borderTop: "0.5pt solid #ccc", paddingTop: 6 } as any}>
          <Text style={[base.muted, { fontSize: 8, textAlign: "center" }]}>{company.nickname}</Text>
        </View>
      </Page>
    </Document>
  );
}
