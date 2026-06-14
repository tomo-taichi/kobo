import { describe, expect, it } from "vitest";
import {
  calcMaterialCostJpy,
  calcCostJpy,
  calcCostEur,
  calcWholesaleEur,
  calcRetailPriceEur,
  calcCustomerWholesaleEur,
  calcDepositAmountEur,
  calcDepositAmountJpy,
} from "./pricing";

// ─── 1. Material cost ────────────────────────────────────────
describe("calcMaterialCostJpy", () => {
  it("sums unit_price × usage_amount across all materials", () => {
    const materials = [
      { unitPriceJpy: 1000, usageAmount: 2.5 },
      { unitPriceJpy: 500, usageAmount: 1 },
    ];
    expect(calcMaterialCostJpy(materials)).toBe(3000);
  });

  it("returns 0 for empty material list", () => {
    expect(calcMaterialCostJpy([])).toBe(0);
  });
});

// ─── 2. Total cost (JPY) ─────────────────────────────────────
describe("calcCostJpy", () => {
  it("sums material cost and all six manufacturing costs", () => {
    expect(
      calcCostJpy(5000, {
        cutting: 1000,
        sewing: 4000,
        knitting: 0,
        thread: 4000,
        finish: 1000,
        packing: 1000,
      })
    ).toBe(16000);
  });

  it("works when all manufacturing costs are 0", () => {
    expect(
      calcCostJpy(5000, {
        cutting: 0,
        sewing: 0,
        knitting: 0,
        thread: 0,
        finish: 0,
        packing: 0,
      })
    ).toBe(5000);
  });
});

// ─── 3. Cost in EUR ──────────────────────────────────────────
describe("calcCostEur", () => {
  it("divides cost_jpy by eur_jpy_rate", () => {
    expect(calcCostEur(13000, 130)).toBeCloseTo(100);
  });

  it("uses the given rate, not a hardcoded default", () => {
    expect(calcCostEur(14000, 140)).toBeCloseTo(100);
  });
});

// ─── 4. Ideal Wholesale price (EUR) ──────────────────────────
describe("calcWholesaleEur", () => {
  it("multiplies cost_eur by markup_rate", () => {
    expect(calcWholesaleEur(100, 3.0)).toBeCloseTo(300);
  });
});

// ─── 5. Retail price (EUR) ───────────────────────────────────
describe("calcRetailPriceEur", () => {
  it("multiplies cost_eur by retail_rate", () => {
    expect(calcRetailPriceEur(100, 3.5)).toBeCloseTo(350);
  });
});

// ─── 6. Customer Wholesale price (EUR) ───────────────────────
describe("calcCustomerWholesaleEur", () => {
  it("applies discount to retail price", () => {
    expect(calcCustomerWholesaleEur(350, 0.35)).toBeCloseTo(227.5);
  });

  it("returns retail price unchanged when discount is 0", () => {
    expect(calcCustomerWholesaleEur(350, 0)).toBe(350);
  });

  it("returns 0 when discount is 1.0 (fully waived)", () => {
    expect(calcCustomerWholesaleEur(350, 1.0)).toBe(0);
  });
});

// ─── 7. Deposit amount (EUR) — floor to nearest 1€ ───────────
describe("calcDepositAmountEur", () => {
  it("floors to nearest 1 EUR", () => {
    // 1234.14 × 1.0 → floor → 1234
    expect(calcDepositAmountEur(1234.14, 1.0)).toBe(1234);
  });

  it("applies deposit rate then floors", () => {
    // 4115.14 × 0.3 = 1234.542 → floor → 1234
    expect(calcDepositAmountEur(4115.14, 0.3)).toBe(1234);
  });
});

// ─── 8. Deposit amount (JPY) — floor to nearest 10¥ ─────────
describe("calcDepositAmountJpy", () => {
  it("floors to nearest 10 JPY", () => {
    // 13334.12 × 1.0 → floor to 10 → 13330
    expect(calcDepositAmountJpy(13334.12, 1.0)).toBe(13330);
  });

  it("applies deposit rate then floors to 10", () => {
    // 44447.07 × 0.3 = 13334.121 → floor to 10 → 13330
    expect(calcDepositAmountJpy(44447.07, 0.3)).toBe(13330);
  });

  it("floors cleanly when result is already a multiple of 10", () => {
    expect(calcDepositAmountJpy(10000, 0.3)).toBe(3000);
  });
});
