import React from "react";
import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { SIZES } from "@/lib/order-constants";

type SizeQty = { size: string; quantity: number };
type DeliveryItem = {
  category: string | null;
  itemName: string;
  whsleJpy: number;
  retailJpy: number;
  sizes: SizeQty[];
  memo: string | null;
};

type Company = {
  nameJa: string;
  addressLines: string[];
  phone: string | null;
  email: string | null;
  sealUrl: string | null;
  registrationNo: string | null;
};

type Props = {
  company: Company;
  customerName: string;
  seasonName: string;
  deliveryDate: string | null;
  taxRate: number;        // 0.10 if tax_included else 0
  items: DeliveryItem[];
  versionLabel?: string | null;
};

function fmtJpy(n: number) {
  return `¥${Math.round(n).toLocaleString("en-US")}`;
}
function sizeLabel(s: string) {
  return s === "Free" ? "F" : s;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()];
  return `${m} ${dt.getDate()}, ${dt.getFullYear()}`;
}

const W_CAT = 46;
const W_PRICE = 50;
const W_SIZE = 13;
const W_QTY = 22;
const W_TOTAL = 52;
const W_MEMO = 56;

export function DeliveryNoteDocument({
  company, customerName, seasonName, deliveryDate, taxRate, items, versionLabel,
}: Props) {
  let totalQty = 0;
  let subtotalRetail = 0;
  let subtotalWholesale = 0;
  for (const it of items) {
    const q = it.sizes.reduce((a, b) => a + b.quantity, 0);
    totalQty += q;
    subtotalRetail += it.retailJpy * q;
    subtotalWholesale += it.whsleJpy * q;
  }
  const tax = Math.round(subtotalWholesale * taxRate);
  const grandTotal = subtotalWholesale + tax;
  const taxPct = Math.round(taxRate * 100);

  const cell = { fontSize: 7, color: "#1a1a1a" };
  const muted = { color: "#8a8a8a" };

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: "NotoSansJP", paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32, fontSize: 8, color: "#1a1a1a" }}>
        {/* Title */}
        <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 14 }}>納品書</Text>

        {/* Customer (left) + Company (right) */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
          <View style={{ flex: 1, alignItems: "center", paddingTop: 8 }}>
            <Text style={{ fontSize: 13, marginBottom: 8 }}>{customerName}　様</Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>Season　{seasonName}</Text>
            <Text style={{ fontSize: 9 }}>納品日　{fmtDate(deliveryDate)}</Text>
          </View>
          <View style={{ width: 240, flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 3 }}>{company.nameJa}</Text>
              {company.addressLines.map((l, i) => (
                <Text key={i} style={{ fontSize: 9, color: "#333" }}>{l}</Text>
              ))}
              <View style={{ height: 6 }} />
              {company.phone ? <Text style={{ fontSize: 9, color: "#333" }}>tel:　{company.phone}</Text> : null}
              {company.email ? <Text style={{ fontSize: 9, color: "#333" }}>email: {company.email}</Text> : null}
              {company.registrationNo ? <Text style={{ fontSize: 9, color: "#333" }}>登録番号: {company.registrationNo}</Text> : null}
            </View>
            {company.sealUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={company.sealUrl} style={{ width: 60, height: 60 }} />
            ) : null}
          </View>
        </View>

        <Text style={{ fontSize: 10, marginBottom: 8 }}>以下のとおり納品いたしました。</Text>

        {/* Product table */}
        <View>
          <View style={{ flexDirection: "row", backgroundColor: "#6b6b6b", paddingVertical: 3, paddingHorizontal: 4 }}>
            <Text style={{ width: W_CAT, fontSize: 6, color: "#fff" }}>category</Text>
            <Text style={{ flex: 1, fontSize: 6, color: "#fff" }}>item</Text>
            <Text style={{ width: W_PRICE, fontSize: 6, color: "#fff", textAlign: "right" }}>whsle</Text>
            <Text style={{ width: W_PRICE, fontSize: 6, color: "#fff", textAlign: "right" }}>retail</Text>
            {SIZES.map((s) => (
              <Text key={s} style={{ width: W_SIZE, fontSize: 6, color: "#fff", textAlign: "center" }}>{sizeLabel(s)}</Text>
            ))}
            <Text style={{ width: W_QTY, fontSize: 6, color: "#fff", textAlign: "right" }}>qty</Text>
            <Text style={{ width: W_TOTAL, fontSize: 6, color: "#fff", textAlign: "right" }}>whsle total</Text>
            <Text style={{ width: W_TOTAL, fontSize: 6, color: "#fff", textAlign: "right" }}>retail total</Text>
            <Text style={{ width: W_MEMO, fontSize: 6, color: "#fff", textAlign: "right" }}>memo</Text>
          </View>

          {items.map((item, idx) => {
            const qty = item.sizes.reduce((a, b) => a + b.quantity, 0);
            return (
              <View key={idx} style={{ flexDirection: "row", borderBottom: "0.5pt solid #eee", paddingVertical: 5, paddingHorizontal: 4, alignItems: "flex-start", backgroundColor: idx % 2 === 1 ? "#fafafa" : "#fff" }}>
                <Text style={{ width: W_CAT, fontSize: 7, ...muted }}>{item.category ?? "—"}</Text>
                <Text style={{ flex: 1, fontSize: 7, paddingRight: 4 }}>{item.itemName}</Text>
                <Text style={{ width: W_PRICE, ...cell, textAlign: "right" }}>{fmtJpy(item.whsleJpy)}</Text>
                <Text style={{ width: W_PRICE, fontSize: 7, ...muted, textAlign: "right" }}>{fmtJpy(item.retailJpy)}</Text>
                {SIZES.map((s) => {
                  const q = item.sizes.find((sz) => sz.size === s)?.quantity ?? 0;
                  return <Text key={s} style={{ width: W_SIZE, ...cell, textAlign: "center" }}>{q > 0 ? q : ""}</Text>;
                })}
                <Text style={{ width: W_QTY, ...cell, textAlign: "right", fontWeight: "bold" }}>{qty}</Text>
                <Text style={{ width: W_TOTAL, ...cell, textAlign: "right" }}>{fmtJpy(item.whsleJpy * qty)}</Text>
                <Text style={{ width: W_TOTAL, fontSize: 7, ...muted, textAlign: "right" }}>{fmtJpy(item.retailJpy * qty)}</Text>
                <Text style={{ width: W_MEMO, fontSize: 6, ...muted, textAlign: "right" }}>{item.memo ?? ""}</Text>
              </View>
            );
          })}

          {/* Grand total strip */}
          <View style={{ flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4 }}>
            <View style={{ width: W_CAT + W_PRICE * 2 }} />
            <View style={{ flex: 1 }} />
            {SIZES.map((s) => <View key={s} style={{ width: W_SIZE }} />)}
            <Text style={{ width: W_QTY, fontSize: 8, textAlign: "right", fontWeight: "bold" }}>{totalQty}</Text>
            <Text style={{ width: W_TOTAL, fontSize: 7, textAlign: "right", ...muted }}>{fmtJpy(subtotalWholesale)}</Text>
            <Text style={{ width: W_TOTAL, fontSize: 7, textAlign: "right", ...muted }}>{fmtJpy(subtotalRetail)}</Text>
            <View style={{ width: W_MEMO }} />
          </View>
        </View>

        {/* Summary: 合計数 box + totals box */}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          {/* 合計数 */}
          <View style={{ flexDirection: "row", height: 26, borderTop: "0.5pt solid #ccc", borderBottom: "0.5pt solid #ccc", borderLeft: "0.5pt solid #ccc" }}>
            <Text style={{ width: 110, fontSize: 9, textAlign: "center", paddingTop: 7, backgroundColor: "#f0f0f0", borderRight: "0.5pt solid #ccc" }}>合計数</Text>
            <Text style={{ width: 90, fontSize: 11, fontWeight: "bold", textAlign: "center", paddingTop: 6, borderRight: "0.5pt solid #ccc" }}>{totalQty}</Text>
          </View>

          {/* totals */}
          <View style={{ width: 230, border: "0.5pt solid #ccc" }}>
            <SummaryRow label="小計（上代）" amount={fmtJpy(subtotalRetail)} />
            <SummaryRow label="小計（下代）" amount={fmtJpy(subtotalWholesale)} />
            <SummaryRow label={`消費税${taxPct ? `（${taxPct}%）` : ""}`} amount={fmtJpy(tax)} />
            <SummaryRow label="合計金額" amount={fmtJpy(grandTotal)} bold last />
          </View>
        </View>

        {versionLabel ? (
          <View style={{ position: "absolute", bottom: 18, right: 32 }} fixed>
            <Text style={{ fontSize: 6.5, color: "#bbb" }}>{versionLabel}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function SummaryRow({ label, amount, bold, last }: { label: string; amount: string; bold?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", borderBottom: last ? undefined : "0.5pt solid #ccc" }}>
      <Text style={{ flex: 1, fontSize: 9, paddingVertical: 4, paddingHorizontal: 8, textAlign: "center", backgroundColor: "#f0f0f0", borderRight: "0.5pt solid #ccc", fontWeight: bold ? "bold" : "normal" }}>{label}</Text>
      <Text style={{ width: 110, fontSize: 10, paddingVertical: 4, paddingHorizontal: 8, textAlign: "right", fontWeight: bold ? "bold" : "normal" }}>{amount}</Text>
    </View>
  );
}
