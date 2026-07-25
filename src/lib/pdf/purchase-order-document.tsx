import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { base } from "./styles";
import type { PurchaseOrderData } from "@/lib/purchase-order";

// ADR-0009 Phase 2 — Japanese Purchase Order (発注書). Reuses the shared PDF
// base styles + NotoSansJP font registered by ensureFonts().
type Props = PurchaseOrderData & { issueDate: string };

export function PurchaseOrderDocument({ company, supplier, seasonName, rows, issueDate }: Props) {
  return (
    <Document>
      <Page size="A4" style={{ ...base.page, paddingBottom: 60 }}>
        {/* Title */}
        <View style={{ marginBottom: 12 }}>
          <Text style={base.title}>発注書</Text>
        </View>

        {/* 宛先 (supplier) + date/season */}
        <View style={[base.section, { marginBottom: 10 }]}>
          <View style={base.row}>
            <Text style={base.label}>宛先</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold", fontSize: 10 }}>
                {supplier.name} {supplier.personName ? `${supplier.personName} 様` : "御中"}
              </Text>
              {supplier.address ? (
                <Text style={[base.muted, { fontSize: 8 }]}>{supplier.address}</Text>
              ) : null}
            </View>
          </View>
          <View style={base.row}>
            <Text style={base.label}>発注日</Text>
            <Text style={base.value}>{issueDate}</Text>
          </View>
          <View style={base.row}>
            <Text style={base.label}>シーズン</Text>
            <Text style={base.value}>{seasonName}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 9, marginBottom: 8 }}>
          いつもお世話になっております。下記の通り発注をお願いいたします。
        </Text>

        <View style={base.divider} />

        {/* Material table */}
        <View style={base.table}>
          <View style={base.tableHeader}>
            <Text style={[base.th, { flex: 1 }]}>素材</Text>
            <Text style={[base.th, { width: 100 }]}>色</Text>
            <Text style={[base.th, { width: 80, textAlign: "right" }]}>発注数</Text>
            <Text style={[base.th, { flex: 1 }]}>備考</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={base.tableRow}>
              <Text style={[base.td, { flex: 1 }]}>{r.materialName}</Text>
              <Text style={[base.td, { width: 100 }]}>{r.colour}</Text>
              <Text style={[base.td, base.right, { width: 80 }]}>
                {r.orderQty} {r.unitType}
              </Text>
              <Text style={[base.td, base.muted, { flex: 1, fontSize: 7 }]}>{r.notes ?? ""}</Text>
            </View>
          ))}
        </View>

        {/* 発注元 (company) block */}
        <View style={{ marginTop: 24, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 10, fontWeight: "bold" }}>{company.name}</Text>
          {company.address ? <Text style={[base.muted, { fontSize: 8 }]}>{company.address}</Text> : null}
          {company.phone ? <Text style={[base.muted, { fontSize: 8 }]}>TEL: {company.phone}</Text> : null}
          {company.email ? <Text style={[base.muted, { fontSize: 8 }]}>{company.email}</Text> : null}
          {company.registrationNo ? (
            <Text style={[base.muted, { fontSize: 8 }]}>登録番号: {company.registrationNo}</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View
          style={{ position: "absolute", bottom: 28, left: 36, right: 36, borderTop: "0.5pt solid #ccc", paddingTop: 6 } as any}
        >
          <Text style={[base.muted, { fontSize: 8, textAlign: "center" }]}>{company.nickname ?? company.name}</Text>
        </View>
      </Page>
    </Document>
  );
}
