export const SIZES = ["1","2","3","4","5","6","7","8","9","10","Free"] as const;
export type Size = typeof SIZES[number];

export const INVOICE_TYPES = ["Original","Additional","Consignment","Revised","Copy","Not_in_Use"] as const;
export const CURRENCY_TYPES = ["EUR","JPY","JPY+EUR"] as const;
export const ORDER_STATUSES = ["A","B","C","D","E","F"] as const;

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  "Original":    "Original",
  "Additional":  "Additional",
  "Consignment": "Consignment",
  "委託":         "Consignment",
  "Revised":     "Revised",
  "Copy":        "Copy",
  "Not_in_Use":  "Not in Use",
};

export const STATUS_LABELS: Record<string, string> = {
  A: "A: OC Sent",
  B: "B: OC Approved",
  C: "C: Deposit Paid",
  D: "D: Final Invoice Sent",
  E: "E: Fully Paid",
  F: "F: Shipped",
};
