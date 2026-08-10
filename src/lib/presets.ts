import { PRODUCT_CATEGORIES } from "@/lib/product-constants";

// Manufacturing autofill is configurable per PRODUCT CATEGORY — every category.
export const MANUFACTURING_CATEGORIES = PRODUCT_CATEGORIES;
export type ManufacturingCategory = (typeof PRODUCT_CATEGORIES)[number];

// Legacy garment buckets — kept only to migrate presets stored under the old
// 5-garment keys into the per-category structure.
export const GARMENT_TYPES = ["TSHIRT", "SHIRT", "TROUSERS", "JACKET", "COAT"] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];
const CATEGORY_TO_GARMENT: Record<ManufacturingCategory, GarmentType | null> = {
  Coat: "COAT", Jacket: "JACKET", Trousers: "TROUSERS", Knitwear: "JACKET",
  Shirt: "SHIRT", "T-shirt": "TSHIRT",
  Shoes: null, Bag: null, Watch: null, Accessories: null, Eyewear: null, Other: null,
};

// Default preset WORK TIME in HOURS per step × product category (ADR-0009 D4).
// Categories with no historical garment mapping default to 0 — set them in Settings.
export const MANUFACTURING_HOUR_PRESETS = {
  cutting:  { Coat: 1.0, Jacket: 0.75, Trousers: 0.5, Knitwear: 0.75, Shirt: 0.5, "T-shirt": 0.25, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
  sewing:   { Coat: 5.0, Jacket: 4.0,  Trousers: 3.0, Knitwear: 4.0,  Shirt: 2.0, "T-shirt": 0.75, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
  knitting: { Coat: 1.0, Jacket: 0.75, Trousers: 0.5, Knitwear: 0.75, Shirt: 0.5, "T-shirt": 0.25, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
  thread:   { Coat: 5.0, Jacket: 4.0,  Trousers: 3.0, Knitwear: 4.0,  Shirt: 2.0, "T-shirt": 0.75, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
  finish:   { Coat: 1.0, Jacket: 0.75, Trousers: 0.5, Knitwear: 0.75, Shirt: 0.5, "T-shirt": 0.25, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
  packing:  { Coat: 1.0, Jacket: 0.75, Trousers: 0.5, Knitwear: 0.75, Shirt: 0.5, "T-shirt": 0.25, Shoes: 0, Bag: 0, Watch: 0, Accessories: 0, Eyewear: 0, Other: 0 },
} as const satisfies Record<string, Record<ManufacturingCategory, number>>;

export type ManufacturingCostKey = keyof typeof MANUFACTURING_HOUR_PRESETS;

// Show hours with at least one decimal (1 → "1.0") but keep finer values (0.25).
export function formatHours(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

// A full (editable) preset matrix: hours per step × product category.
export type ManufacturingHourPresets = Record<ManufacturingCostKey, Record<ManufacturingCategory, number>>;

// Merge a (possibly partial/legacy) stored matrix over the built-in defaults so
// every step × category cell is a finite, non-negative number. Falls back to the
// old garment-type key when a category value is missing (seamless migration).
export function normalizeManufacturingPresets(raw: unknown): ManufacturingHourPresets {
  const r = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const keys = Object.keys(MANUFACTURING_HOUR_PRESETS) as ManufacturingCostKey[];
  const out = {} as ManufacturingHourPresets;
  for (const k of keys) {
    out[k] = {} as Record<ManufacturingCategory, number>;
    for (const c of MANUFACTURING_CATEGORIES) {
      let v = Number(r?.[k]?.[c]);
      if (!(Number.isFinite(v) && v >= 0)) {
        const g = CATEGORY_TO_GARMENT[c];
        const vg = g ? Number(r?.[k]?.[g]) : NaN;
        v = Number.isFinite(vg) && vg >= 0 ? vg : MANUFACTURING_HOUR_PRESETS[k][c];
      }
      out[k][c] = v;
    }
  }
  return out;
}

export const MANUFACTURING_COST_LABELS: Record<ManufacturingCostKey, string> = {
  cutting:  "Cutting",
  sewing:   "Sewing",
  knitting: "Knitting",
  thread:   "Thread",
  finish:   "Finishing",
  packing:  "Packing",
};

export const FABRIC_MATERIAL_GROUPS = [
  "main", "lining", "body_lining", "sleeve_lining",
  "pocket_front", "pocket_back", "interlining",
] as const;

export const ACCESSORY_MATERIAL_GROUPS = [
  "accessory_parts", "accessory_tag",
] as const;

export const MATERIAL_GROUP_LABELS: Record<string, string> = {
  main: "Main",
  lining: "Lining",
  body_lining: "Body Lining",
  sleeve_lining: "Sleeve Lining",
  pocket_front: "Pocket (Front)",
  pocket_back: "Pocket (Back)",
  interlining: "Interlining",
  accessory_parts: "Accessory Parts",
  accessory_tag: "Accessory Tag",
};
