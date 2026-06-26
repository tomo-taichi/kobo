export type MaterialUsage = {
  unitPriceJpy: number;
  usageAmount: number;
};

export type ManufacturingCosts = {
  cutting: number;
  sewing: number;
  knitting: number;
  thread: number;
  finish: number;
  packing: number;
};

export function calcMaterialCostJpy(materials: MaterialUsage[]): number {
  return materials.reduce(
    (sum, m) => sum + m.unitPriceJpy * m.usageAmount,
    0
  );
}

export function calcCostJpy(
  materialCostJpy: number,
  manufacturing: ManufacturingCosts
): number {
  return (
    materialCostJpy +
    manufacturing.cutting +
    manufacturing.sewing +
    manufacturing.knitting +
    manufacturing.thread +
    manufacturing.finish +
    manufacturing.packing
  );
}

export function calcCostEur(costJpy: number, eurJpyRate: number): number {
  return costJpy / eurJpyRate;
}

export function calcWholesaleEur(costEur: number, markupRate: number): number {
  return costEur * markupRate;
}

// Reference retail price = Ideal WS (EUR) × Retail Margin Rate. This is only a
// suggestion shown next to the manually-set retail price; the actual
// products.retail_price_eur is entered by hand and is the price Orders adopt.
export function calcRetailRefEur(idealWsEur: number, retailRate: number): number {
  return idealWsEur * retailRate;
}

export function calcRetailPriceEur(costEur: number, retailRate: number): number {
  return costEur * retailRate;
}

export function calcCustomerWholesaleEur(
  retailPriceEur: number,
  discountRate: number
): number {
  return retailPriceEur * (1 - discountRate);
}

export function calcDepositAmountEur(
  subtotalRetailEur: number,
  depositRate: number
): number {
  return Math.floor(subtotalRetailEur * depositRate);
}

export function calcDepositAmountJpy(
  subtotalRetailJpy: number,
  depositRate: number
): number {
  return Math.floor((subtotalRetailJpy * depositRate) / 1000) * 1000;
}
