import { describe, expect, it } from "vitest";
import { buildOrderEmail } from "./purchase-order";

describe("buildOrderEmail", () => {
  const base = {
    seasonName: "2026SS",
    personName: "山田",
    companyName: "KOBO",
    companyAddress: "Tokyo",
    companyPhone: "03-0000-0000",
    companyEmail: "hello@kobo.jp",
    rows: [
      { materialName: "Cotton", colour: "White", orderQty: 12.5, unitType: "m", notes: null },
      { materialName: "Wool", colour: "Navy", orderQty: 8, unitType: "m", notes: null },
    ],
  };

  it("subject includes the season name", () => {
    expect(buildOrderEmail(base).subject).toBe("【2026SS】生地発注のお願い");
  });

  it("body lists each material with colour, qty and unit", () => {
    const { body } = buildOrderEmail(base);
    expect(body).toContain("・Cotton（White）：12.5 m");
    expect(body).toContain("・Wool（Navy）：8 m");
  });

  it("addresses the named contact with 様", () => {
    expect(buildOrderEmail(base).body.startsWith("山田 様")).toBe(true);
  });

  it("falls back to ご担当者様 when no contact name", () => {
    expect(buildOrderEmail({ ...base, personName: null }).body.startsWith("ご担当者様")).toBe(true);
  });

  it("includes company footer block", () => {
    const { body } = buildOrderEmail(base);
    expect(body).toContain("KOBO");
    expect(body).toContain("TEL: 03-0000-0000");
    expect(body).toContain("hello@kobo.jp");
  });
});
