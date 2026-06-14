import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import { base } from "./styles";
import { LABELS, type PdfLang, type CompanyInfo, type PaymentTerms } from "./labels";

type Props = {
  lang: PdfLang;
  company: CompanyInfo;
  customerName: string;
  customerAddress: string;
  seasonName: string;
  orderDate: string | null;
  currency: string;               // "EUR" | "JPY" (customers.currency)
  depositAmountEur: number | null;
  depositAmountJpy: number | null;
  invoiceCount: number;
  paymentTerms: PaymentTerms;
  bankDetails: string[] | null;
  paymentDeadline: string | null;  // YYYY/MM/DD (Phase 4 popup); null until then
  versionLabel?: string | null;
};

export function DepositInvoiceDocument({
  lang, company, customerName, customerAddress, seasonName, orderDate,
  currency, depositAmountEur, depositAmountJpy, invoiceCount, paymentTerms,
  bankDetails, paymentDeadline, versionLabel,
}: Props) {
  const L = LABELS[lang];
  const showJpy = currency === "JPY";
  const showEur = currency === "EUR";

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
          <Text style={base.title}>{L.depositInvoice}</Text>
          <Text style={[base.muted, { fontSize: 8 }]}>
            {L.invoiceNo} DEP-{String(invoiceCount + 1).padStart(4, "0")}
            {versionLabel ? `  (${versionLabel})` : ""}
          </Text>
        </View>

        {/* Order info */}
        <View style={base.section}>
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
          {paymentDeadline ? (
            <View style={base.row}>
              <Text style={base.label}>{lang === "ja" ? "お支払い期限" : "Payment Deadline"}</Text>
              <Text style={[base.value, { fontWeight: "bold" }]}>{paymentDeadline}</Text>
            </View>
          ) : null}
        </View>

        <View style={base.divider} />

        {/* Deposit amount */}
        <View style={{ marginVertical: 24, alignItems: "center" }}>
          <Text style={[base.subtitle, { marginBottom: 4 }]}>{L.depositAmount}</Text>
          {showEur && depositAmountEur != null && (
            <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 8 }}>
              € {depositAmountEur.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          )}
          {showJpy && depositAmountJpy != null && (
            <Text style={{ fontSize: 22, fontWeight: "bold" }}>
              ¥ {Math.round(depositAmountJpy).toLocaleString()}
            </Text>
          )}
          {!depositAmountEur && !depositAmountJpy && (
            <Text style={base.muted}>{lang === "ja" ? "前払い金額が未設定です" : "Deposit amount not set"}</Text>
          )}
        </View>

        <View style={base.divider} />

        {/* Payment Term */}
        {paymentTerms ? (
          <View style={{ marginTop: 4 }}>
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
