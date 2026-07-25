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

// The six manufacturing steps entered as WORK TIME (minutes). Amount = time × labor rate.
// See ADR-0009 (D4/D5): all six steps are time-based; rate is company_settings.labor_rate_jpy_per_hour.
export type ManufacturingMinutes = ManufacturingCosts;

// One step's JPY amount from its minutes at the hourly labor rate, rounded to whole yen
// (matches the migration backfill round(cost/rate*60) round-trip).
export function calcMfgAmountJpy(minutes: number, ratePerHour: number): number {
  return Math.round((minutes / 60) * ratePerHour);
}

// Convert the six time inputs into the six JPY amounts.
export function mfgMinutesToAmounts(minutes: ManufacturingMinutes, ratePerHour: number): ManufacturingCosts {
  return {
    cutting:  calcMfgAmountJpy(minutes.cutting,  ratePerHour),
    sewing:   calcMfgAmountJpy(minutes.sewing,   ratePerHour),
    knitting: calcMfgAmountJpy(minutes.knitting, ratePerHour),
    thread:   calcMfgAmountJpy(minutes.thread,   ratePerHour),
    finish:   calcMfgAmountJpy(minutes.finish,   ratePerHour),
    packing:  calcMfgAmountJpy(minutes.packing,  ratePerHour),
  };
}

export function totalMfgMinutes(m: ManufacturingMinutes): number {
  return m.cutting + m.sewing + m.knitting + m.thread + m.finish + m.packing;
}

// Manufacturing time is ENTERED in HOURS (1 decimal) on the form; the DB stores minutes,
// so the form converts hours → minutes (×60) at save. Amount from hours = hours × rate.
export function calcMfgAmountFromHours(hours: number, ratePerHour: number): number {
  return Math.round(hours * ratePerHour);
}
export function mfgHoursToMinutes(hours: ManufacturingMinutes): ManufacturingMinutes {
  return {
    cutting:  hours.cutting  * 60,
    sewing:   hours.sewing   * 60,
    knitting: hours.knitting * 60,
    thread:   hours.thread   * 60,
    finish:   hours.finish   * 60,
    packing:  hours.packing  * 60,
  };
}

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
