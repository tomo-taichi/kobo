export const FABRIC_CATEGORIES = ["woven", "knitted", "leather"] as const;
export const ACCESSORY_CATEGORIES = ["accessory", "eyewear", "other"] as const;
export const MATERIAL_CATEGORIES = [...FABRIC_CATEGORIES, ...ACCESSORY_CATEGORIES] as const;
export const UNIT_TYPES = ["meter", "piece", "ds"] as const;

export function isFabric(category: string): boolean {
  return FABRIC_CATEGORIES.includes(category as typeof FABRIC_CATEGORIES[number]);
}

export const CATEGORY_LABELS: Record<string, string> = {
  woven: "Woven",
  knitted: "Knitted",
  leather: "Leather",
  accessory: "Accessory",
  eyewear: "Eyewear",
  other: "Other",
};

export const UNIT_TYPE_LABELS: Record<string, string> = {
  meter: "m",
  piece: "個",
  ds: "ds",
};

export const COMPOSITION_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "天然繊維",
    items: [
      "綿-COTTON",
      "海島綿-SEA ISLAND COTTON",
      "毛-VIRGIN WOOL",
      "英国羊毛-BRITISH WOOL",
      "ｶｼﾐｱ-CASHMERE",
      "ﾓﾝｺﾞﾘｱﾝｶｼﾐｱ-MONGOLIAN CASHMERE",
      "ｱﾙﾊﾟｶ-ALPACA",
      "ｱﾝｺﾞﾗ-ANGOLA",
      "絹-SILK",
      "ﾗﾐｰ-RAMIE",
      "麻-LINEN",
      "ﾍﾝﾌﾟ-HEMP",
    ],
  },
  {
    label: "化学繊維",
    items: [
      "反射ﾅｲﾛﾝ-REFLECT NYLON",
      "ﾅｲﾛﾝ-NYLON",
      "ﾎﾟﾘｴｽﾃﾙ-POLYESTER",
      "ﾎﾟﾘｴﾁﾚﾝ-POLYETHYLENE",
      "ﾎﾟﾘｳﾚﾀﾝ-POLYURETHANE",
      "金属繊維-METAL FIBERS",
      "ｷｭﾌﾟﾗ-CUPRA",
      "ﾚｰﾖﾝ-RAYON",
      "ｺｰﾃﾞｨﾗ-CORDURA",
    ],
  },
  {
    label: "皮革",
    items: [
      "仔牛-CALF FULL GRAIN",
      "水牛-BISON FULL GRAIN",
      "馬-HORSE FULL GRAIN",
      "ｸﾛｺﾀﾞｲﾙ-CROCODILE",
      "ｶﾝｶﾞﾙｰ-KANGAROO FULL GRAIN",
      "鹿-DEER",
    ],
  },
  {
    label: "金属・その他",
    items: [
      "印刷紙-PRINTED PAPER",
      "ｽｽﾞ-TIN",
      "銀-SILVER925",
      "鉄-IRON",
      "ﾁﾀﾝ-TITANIUM",
      "ｽﾃｨｰﾙ-STAINLESS STEEL",
      "ｱﾙﾐﾆｳﾑ-ALUMINIUM",
      "真鍮-BRASS",
      "水牛角-BUFFALO HORN",
      "ｴﾌｱｰﾙﾋﾟｰ-FRP",
    ],
  },
];

export const MAX_COMPOSITIONS = 5;

type MaterialForStatus = {
  set_price_jpy?: number | null;
  comp_1_pct?: number | null;
  comp_2_pct?: number | null;
  comp_3_pct?: number | null;
  comp_4_pct?: number | null;
  comp_5_pct?: number | null;
};

export function getMaterialStatus(m: MaterialForStatus): "完成" | "未入力" {
  if (!m.set_price_jpy || Number(m.set_price_jpy) <= 0) return "未入力";
  const total = [m.comp_1_pct, m.comp_2_pct, m.comp_3_pct, m.comp_4_pct, m.comp_5_pct]
    .reduce((sum, p) => sum + (p ?? 0), 0);
  return total === 100 ? "完成" : "未入力";
}
