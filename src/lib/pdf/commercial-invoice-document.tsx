import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { base } from "./styles";
import { SIZES } from "@/lib/order-constants";
import { LABELS, type PdfLang, type CompanyInfo } from "./labels";

type SizeQty = { size: string; quantity: number };
type OrderItem = {
  productId: string;
  productCategory: string | null;
  modelName: string;
  color: string | null;
  customerWholesaleEur: number;
  sizes: SizeQty[];
  materials: string[];
};

type Props = {
  lang: PdfLang;
  company: CompanyInfo;
  customerName: string;
  customerAddress: string;
  seasonName: string;
  orderDate: string | null;
  currencyType: string;
  exchangeRate: number | null;
  isOverseas: boolean;
  items: OrderItem[];
  versionLabel?: string | null;
};

function fmtEur(n: number) {
  return `€ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CommercialInvoiceDocument({
  lang, company, customerName, customerAddress, seasonName, orderDate,
  currencyType, exchangeRate, isOverseas, items, versionLabel,
}: Props) {
  const L = LABELS[lang];
  const title = isOverseas ? L.commercialInvoice : L.deliveryNote;

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
          <Text style={base.title}>{title}</Text>
          {versionLabel ? (
            <Text style={[base.muted, { fontSize: 8 }]}>({versionLabel})</Text>
          ) : null}
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
          {isOverseas && (
            <View style={base.row}>
              <Text style={base.label}>{L.countryOfOrigin}</Text>
              <Text style={[base.value, { fontWeight: "bold" }]}>{L.japan}</Text>
            </View>
          )}
        </View>

        <View style={base.divider} />

        {/* Product table */}
        <View style={base.table}>
          <View style={base.tableHeader}>
            <Text style={[base.th, { width: 42 }]}>{L.colId}</Text>
            <Text style={[base.th, { width: 55 }]}>{L.colCategory}</Text>
            <Text style={[base.th, { flex: 1 }]}>{L.colProduct}</Text>
            <Text style={[base.th, { width: 72 }]}>{L.colSizes}</Text>
            <Text style={[base.th, { width: 22, textAlign: "right" }]}>{L.colQty}</Text>
            {isOverseas ? (
              <>
                <Text style={[base.th, { width: 52, textAlign: "right" }]}>{L.unitPrice}</Text>
                <Text style={[base.th, { flex: 1 }]}>
                  {lang === "ja" ? "素材" : "Material"}
                </Text>
              </>
            ) : null}
          </View>
          {items.map((item, idx) => {
            const totalQty = item.sizes.reduce((a, b) => a + b.quantity, 0);
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
                <Text style={[base.td, base.muted, { width: 55, fontSize: 7 }]}>{item.productCategory ?? "—"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[base.td, { fontSize: 9 }]}>{item.modelName}</Text>
                  {item.color ? (
                    <Text style={[base.td, base.muted, { fontSize: 7 }]}>{item.color}</Text>
                  ) : null}
                </View>
                <Text style={[base.td, { width: 72, fontSize: 7 }]}>{sizeBreakdown || "—"}</Text>
                <Text style={[base.td, base.right, { width: 22, fontSize: 8 }]}>{totalQty}</Text>
                {isOverseas ? (
                  <>
                    <Text style={[base.td, base.right, { width: 52, fontSize: 7 }]}>{fmtEur(item.customerWholesaleEur)}</Text>
                    <Text style={[base.td, { flex: 1, fontSize: 7 }]}>{item.materials.join(", ") || "—"}</Text>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>

        {isOverseas && (
          <View style={{ marginTop: 8 }}>
            <Text style={[base.muted, { fontSize: 8 }]}>{L.allMadeInJapan}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={{ position: "absolute", bottom: 28, left: 36, right: 36, borderTop: "0.5pt solid #ccc", paddingTop: 6 } as any}>
          <Text style={[base.muted, { fontSize: 8, textAlign: "center" }]}>{company.nickname}</Text>
        </View>
      </Page>
    </Document>
  );
}
