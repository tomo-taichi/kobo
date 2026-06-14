export type PdfLang = "en" | "ja";

export const LABELS = {
  en: {
    orderConfirmation: "ORDER CONFIRMATION",
    depositInvoice: "DEPOSIT INVOICE",
    finalInvoice: "FINAL INVOICE",
    commercialInvoice: "COMMERCIAL INVOICE",
    deliveryNote: "DELIVERY NOTE",
    to: "To:",
    season: "Season:",
    date: "Date:",
    discount: "Discount:",
    exchangeRate: "Exchange Rate:",
    colId: "ID",
    colCategory: "Category",
    colProduct: "Product",
    colSizes: "Sizes",
    colRetail: "Retail",
    colWs: "WS",
    colQty: "Qty",
    colTotal: "Total WS",
    subtotalRetail: "Subtotal (Retail)",
    subtotalWs: "Subtotal (WS)",
    total: "Total",
    deposit: "Deposit",
    balance: "Balance Due",
    invoiceNo: "No.",
    depositAmount: "DEPOSIT AMOUNT",
    countryOfOrigin: "Country of Origin:",
    japan: "JAPAN",
    allMadeInJapan: "All goods manufactured in Japan. Country of Origin: JAPAN.",
    unitPrice: "Unit Price",
  },
  ja: {
    orderConfirmation: "オーダーコンファーメーション",
    depositInvoice: "前払いインボイス",
    finalInvoice: "ファイナルインボイス",
    commercialInvoice: "商業インボイス",
    deliveryNote: "納品書",
    to: "宛先：",
    season: "シーズン：",
    date: "日付：",
    discount: "割引：",
    exchangeRate: "為替レート：",
    colId: "商品ID",
    colCategory: "カテゴリー",
    colProduct: "商品名",
    colSizes: "サイズ×数量",
    colRetail: "小売",
    colWs: "WS",
    colQty: "数量",
    colTotal: "WS合計",
    subtotalRetail: "小売合計",
    subtotalWs: "WS合計",
    total: "合計",
    deposit: "前払い",
    balance: "残額",
    invoiceNo: "No.",
    depositAmount: "前払い金額",
    countryOfOrigin: "原産国：",
    japan: "日本",
    allMadeInJapan: "全製品は日本製です。原産国：日本。",
    unitPrice: "単価",
  },
} as const;

export function getLang(groupType: string | null | undefined): PdfLang {
  return groupType === "Domestic" ? "ja" : "en";
}

export type CompanyInfo = {
  name: string;
  address: string;
  nickname: string;
};

// ── Order Confirmation specific labels ──
export const OC_LABELS = {
  en: {
    orderConfirmation: "Order Confirmation",
    orderNo: "ORDER #:",
    date: "DATE",
    season: "SEASON",
    customerId: "CUSTOMER ID",
    colCategory: "category",
    colId: "ID",
    colItem: "item",
    colWholesale: "wholesale",
    colRetail: "retail",
    colQty: "qty",
    colWhsleTotal: "whsle total",
    colRetailTotal: "retail total",
    colMemo: "memo",
    paymentTerm: "Payment Term:",
    subtotalRetail: "Subtotal (retail)",
    subtotalWholesale: "Subtotal (wholesale)",
    tax: "Tax",
    total: "Total",
  },
  ja: {
    orderConfirmation: "オーダーコンファーメーション",
    orderNo: "オーダー番号:",
    date: "日付",
    season: "シーズン",
    customerId: "顧客ID",
    colCategory: "カテゴリ",
    colId: "ID",
    colItem: "品名",
    colWholesale: "卸値",
    colRetail: "小売",
    colQty: "数量",
    colWhsleTotal: "卸合計",
    colRetailTotal: "小売合計",
    colMemo: "備考",
    paymentTerm: "お支払い条件:",
    subtotalRetail: "小売 小計",
    subtotalWholesale: "卸 小計",
    tax: "消費税",
    total: "合計",
  },
} as const;

/**
 * Bank-detail lines for the invoice, chosen by `customers.bank`.
 * Content lives in company_settings (editable). Returns null if no bank set.
 */
export function bankDetailLines(
  bank: string | null | undefined,
  wiseEu: string | null | undefined,
  rakutenJp: string | null | undefined,
): string[] | null {
  const raw =
    bank === "WISE_EU" ? wiseEu :
    bank === "Rakuten_JP" ? rakutenJp :
    null;
  if (!raw) return null;
  const lines = raw.split("\n").map((s) => s.replace(/\s+$/, "")).filter((s) => s.length > 0);
  return lines.length ? lines : null;
}

export type PaymentTerms = { label: string; lines: string[] } | null;

/**
 * Build the Payment Term block, driven by the client's `group_type`.
 * Shown on Order Confirmation, Deposit Invoice and Final Invoice.
 *
 * - Domestic  → fixed Japanese terms (monthly closing / no web pricing / no sales)
 * - Customer  → fixed Japanese terms (made-to-order, 7-day payment, no cancellation)
 * - Personal  → no payment term block (returns null)
 * - Overseas  → English terms based on deposit_terms (deposit vs full payment).
 *               `hasDeposit` = customers.deposit_terms === "Deposit_and_Production",
 *               `depositPct` = deposit rate as a whole number, `brand` = nickname.
 */
export function buildPaymentTerms(
  groupType: string | null | undefined,
  hasDeposit: boolean,
  depositPct: number,
  brand: string,
): PaymentTerms {
  switch (groupType) {
    case "Domestic":
      return {
        label: "お支払い条件:",
        lines: [
          "お支払い条件は、月末締め・翌月末払いにてお願いしております。",
          "商品価格のWebサイト上での掲載はお控えいただきますようお願い申し上げます。",
          "セール販売はお断りしております。また、Webサイト上での値引き表示、セール告知、クーポン配布等につきましてもご遠慮くださいますようお願い申し上げます。",
        ],
      };
    case "Customer":
      return {
        label: "お支払い条件:",
        lines: [
          "本商品は受注生産品となります。",
          "ご入金確認後に製作を開始いたしますので、お支払いは請求書発行日より7日以内にお願いいたします。",
          "なお、ご入金確認後のキャンセル・返金はお受けいたしかねます。",
        ],
      };
    case "Personal":
      return null;
    case "Overseas":
    default: {
      const lines = hasDeposit
        ? [
            `- ${depositPct}% deposit is required by T/T remittance within 7 days upon order placement.`,
            "- The rest is required by T/T remittance before shipment.",
          ]
        : ["- Full payment is required by T/T remittance before shipment."];
      return {
        label: "Payment Term:",
        lines: [
          ...lines,
          "- Bank fees are on your account.",
          `- ${brand} products are strictly prohibited from being sold on discount via the internet.`,
          "- DO NOT put the price on the internet.",
        ],
      };
    }
  }
}
