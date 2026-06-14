const EUR_FMT_2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EUR_FMT_0 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Format a Euro amount with thousands separator. Defaults to 2 decimal places. */
export function fmtEur(amount: number, decimals: 0 | 2 = 2): string {
  return (decimals === 0 ? EUR_FMT_0 : EUR_FMT_2).format(amount);
}
