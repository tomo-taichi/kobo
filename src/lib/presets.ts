export const GARMENT_TYPES = ["TSHIRT", "SHIRT", "TROUSERS", "JACKET", "COAT"] as const;
export type GarmentType = typeof GARMENT_TYPES[number];

export const MANUFACTURING_COST_PRESETS = {
  cutting:  { TSHIRT: 500,  SHIRT: 1000, TROUSERS: 1000, JACKET: 1500,  COAT: 2000  },
  sewing:   { TSHIRT: 1500, SHIRT: 4000, TROUSERS: 6000, JACKET: 8000,  COAT: 10000 },
  knitting: { TSHIRT: 500,  SHIRT: 1000, TROUSERS: 1000, JACKET: 1500,  COAT: 2000  },
  thread:   { TSHIRT: 1500, SHIRT: 4000, TROUSERS: 6000, JACKET: 8000,  COAT: 10000 },
  finish:   { TSHIRT: 500,  SHIRT: 1000, TROUSERS: 1000, JACKET: 1500,  COAT: 2000  },
  packing:  { TSHIRT: 500,  SHIRT: 1000, TROUSERS: 1000, JACKET: 1500,  COAT: 2000  },
} as const satisfies Record<string, Record<GarmentType, number>>;

export type ManufacturingCostKey = keyof typeof MANUFACTURING_COST_PRESETS;

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
  main: "メイン",
  lining: "裏地",
  body_lining: "胴裏",
  sleeve_lining: "袖裏",
  pocket_front: "ポケット前",
  pocket_back: "ポケット後",
  interlining: "芯地",
  accessory_parts: "副資材パーツ",
  accessory_tag: "副資材タグ",
};
