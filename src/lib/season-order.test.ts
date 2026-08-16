import { describe, it, expect } from "vitest";
import { seasonSortKey } from "./season-order";

const k = (n: string) => seasonSortKey(n)!;

describe("seasonSortKey", () => {
  it("orders new-format seasons (YY.1 = SS < YY.2 = AW)", () => {
    expect(k("26.1") < k("26.2")).toBe(true);
    expect(k("26.2") < k("27.1")).toBe(true);
  });

  it("orders old-format seasons (SS < AW within a year)", () => {
    expect(k("22SS") < k("22AW")).toBe(true);
    expect(k("14AW") < k("22SS")).toBe(true);
  });

  it("places a pop-up in its year, mid-season (SS < POP < AW)", () => {
    expect(k("22SS") < k("22POP")).toBe(true);
    expect(k("22POP") < k("22AW")).toBe(true);
    // 22POP is 2022 → earlier than any 2023+ season, later than 2021.
    expect(k("21AW") < k("22POP")).toBe(true);
    expect(k("22POP") < k("23.1")).toBe(true);
  });

  it("ranks the two formats on one timeline (22AW is older than 27.1)", () => {
    // The bug this fixes: 22AW must sort BEFORE 27.1, not after.
    expect(k("22AW") < k("27.1")).toBe(true);
  });

  it("returns null for season-agnostic / unknown names", () => {
    for (const n of ["ALLSS", "委託", "", "  ", "nonsense", null, undefined]) {
      expect(seasonSortKey(n)).toBeNull();
    }
  });
});
