const EUR_FMT_2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EUR_FMT_0 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Format a Euro amount with thousands separator. Defaults to 2 decimal places. */
export function fmtEur(amount: number, decimals: 0 | 2 = 2): string {
  return (decimals === 0 ? EUR_FMT_0 : EUR_FMT_2).format(amount);
}

/** Product id as "P000123" (product_number, zero-padded to 6 digits). */
export function fmtProductId(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const n = parseInt(String(raw).replace(/^P/i, ""), 10);
  if (Number.isNaN(n)) return String(raw);
  return "P" + String(n).padStart(6, "0");
}

/** Per-colour SKU derived from the product number + a 1-based colour index,
 *  e.g. colorSku(123, 2) → "P000123-02". */
export function colorSku(productNumber: string | number | null | undefined, colorIndex: number): string {
  return `${fmtProductId(productNumber)}-${String(colorIndex).padStart(2, "0")}`;
}
