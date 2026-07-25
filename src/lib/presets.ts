export const GARMENT_TYPES = ["TSHIRT", "SHIRT", "TROUSERS", "JACKET", "COAT"] as const;
export type GarmentType = typeof GARMENT_TYPES[number];

// Preset WORK TIME in MINUTES per garment type (ADR-0009 D4). These are the old JPY presets
// converted at ¥2000/hour (amount ÷ 2000 × 60): e.g. sewing COAT ¥10,000 → 300 min.
export const MANUFACTURING_MINUTE_PRESETS = {
  cutting:  { TSHIRT: 15, SHIRT: 30,  TROUSERS: 30,  JACKET: 45,  COAT: 60  },
  sewing:   { TSHIRT: 45, SHIRT: 120, TROUSERS: 180, JACKET: 240, COAT: 300 },
  knitting: { TSHIRT: 15, SHIRT: 30,  TROUSERS: 30,  JACKET: 45,  COAT: 60  },
  thread:   { TSHIRT: 45, SHIRT: 120, TROUSERS: 180, JACKET: 240, COAT: 300 },
  finish:   { TSHIRT: 15, SHIRT: 30,  TROUSERS: 30,  JACKET: 45,  COAT: 60  },
  packing:  { TSHIRT: 15, SHIRT: 30,  TROUSERS: 30,  JACKET: 45,  COAT: 60  },
} as const satisfies Record<string, Record<GarmentType, number>>;

export type ManufacturingCostKey = keyof typeof MANUFACTURING_MINUTE_PRESETS;

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
