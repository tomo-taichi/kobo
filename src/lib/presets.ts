export const GARMENT_TYPES = ["TSHIRT", "SHIRT", "TROUSERS", "JACKET", "COAT"] as const;
export type GarmentType = typeof GARMENT_TYPES[number];

// Preset WORK TIME in HOURS per garment type (ADR-0009 D4). Old JPY presets ÷ ¥2000/hour:
// e.g. sewing COAT ¥10,000 → 5.0 h, cutting JACKET ¥1,500 → 0.75 h.
export const MANUFACTURING_HOUR_PRESETS = {
  cutting:  { TSHIRT: 0.25, SHIRT: 0.5, TROUSERS: 0.5, JACKET: 0.75, COAT: 1.0 },
  sewing:   { TSHIRT: 0.75, SHIRT: 2.0, TROUSERS: 3.0, JACKET: 4.0,  COAT: 5.0 },
  knitting: { TSHIRT: 0.25, SHIRT: 0.5, TROUSERS: 0.5, JACKET: 0.75, COAT: 1.0 },
  thread:   { TSHIRT: 0.75, SHIRT: 2.0, TROUSERS: 3.0, JACKET: 4.0,  COAT: 5.0 },
  finish:   { TSHIRT: 0.25, SHIRT: 0.5, TROUSERS: 0.5, JACKET: 0.75, COAT: 1.0 },
  packing:  { TSHIRT: 0.25, SHIRT: 0.5, TROUSERS: 0.5, JACKET: 0.75, COAT: 1.0 },
} as const satisfies Record<string, Record<GarmentType, number>>;

export type ManufacturingCostKey = keyof typeof MANUFACTURING_HOUR_PRESETS;

// Show hours with at least one decimal (1 → "1.0") but keep finer values (0.25).
export function formatHours(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

// A full (editable) preset matrix: hours per step × garment type.
export type ManufacturingHourPresets = Record<ManufacturingCostKey, Record<GarmentType, number>>;

// Merge a (possibly partial/invalid) stored matrix over the built-in defaults so
// every step × garment cell is always a finite, non-negative number.
export function normalizeManufacturingPresets(raw: unknown): ManufacturingHourPresets {
  const r = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const keys = Object.keys(MANUFACTURING_HOUR_PRESETS) as ManufacturingCostKey[];
  const out = {} as ManufacturingHourPresets;
  for (const k of keys) {
    out[k] = {} as Record<GarmentType, number>;
    for (const g of GARMENT_TYPES) {
      const v = Number(r?.[k]?.[g]);
      out[k][g] = Number.isFinite(v) && v >= 0 ? v : MANUFACTURING_HOUR_PRESETS[k][g];
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
