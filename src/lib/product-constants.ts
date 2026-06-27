export const CLEANING_INSTRUCTIONS = ["A", "B", "C", "D", "E", "NA"] as const;

export function suggestHSCode(
  category: string | null | undefined,
  sex: string | null | undefined,
  comp1Label: string | null | undefined
): string {
  if (!category) return "";
  const mat = (comp1Label ?? "").toLowerCase();
  const isWool    = /wool|cashmere|camel|alpaca|angora/.test(mat);
  const isSilk    = /silk/.test(mat);
  const isCotton  = /cotton|linen|ramie|hemp/.test(mat);
  const isSynth   = /polyester|nylon|acrylic|polyurethane|polyethylene/.test(mat);
  const isLeather = /leather|suede/.test(mat);
  const isMen     = !sex || sex === "Men" || sex === "Unisex";

  switch (category) {
    case "Coat": {
      const m = isWool ? "11" : isCotton ? "12" : isSynth ? "13" : "19";
      return isMen ? `6201.${m}` : `6202.${m}`;
    }
    case "Jacket": {
      const m = isWool ? "31" : isCotton ? "32" : isSynth ? "33" : "39";
      return isMen ? `6203.${m}` : `6204.${m}`;
    }
    case "Trousers": {
      const m = isWool ? "41" : isCotton ? "42" : isSynth ? "43" : "49";
      return isMen ? `6203.${m}` : `6204.${m}`;
    }
    case "Knitwear":
      return isWool ? "6110.11" : isSilk ? "6110.90" : isCotton ? "6110.20" : "6110.30";
    case "Shirt":
      if (isMen) return isWool || isSilk ? "6205.10" : isCotton ? "6205.20" : isSynth ? "6205.30" : "6205.90";
      return isSilk ? "6206.10" : isWool ? "6206.20" : isCotton ? "6206.30" : isSynth ? "6206.40" : "6206.90";
    case "T-shirt":
      return isCotton ? "6109.10" : "6109.90";
    case "Shoes":
      return isLeather ? "6403.99" : "6404.19";
    case "Bag":
      return isLeather ? "4202.21" : "4202.29";
    case "Watch":
      return "9102.19";
    case "Accessories":
      return "6217.10";
    case "Eyewear":
      return "9004.90";
    default:
      return "";
  }
}

export const PRODUCT_CATEGORIES = [
  "Coat",
  "Jacket",
  "Trousers",
  "Knitwear",
  "Shirt",
  "T-shirt",
  "Shoes",
  "Bag",
  "Watch",
  "Accessories",
  "Eyewear",
  "Other",
] as const;

export const PRODUCT_SEXES = ["Men", "Women", "Unisex", "Kids"] as const;

// Default orderable sizes per category (overridable per product on the product form).
// Apparel → numeric 1–10; footwear/bags/jewellery/eyewear → Free; Other → everything.
// Sizes here must stay a subset of order-constants SIZES.
const NUMERIC_SIZES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const FREE_ONLY = ["Free"];
const ALL_SIZES = [...NUMERIC_SIZES, ...FREE_ONLY];

const ORDERABLE_SIZE_DEFAULTS: Record<string, string[]> = {
  Coat: NUMERIC_SIZES,
  Jacket: NUMERIC_SIZES,
  Trousers: NUMERIC_SIZES,
  Knitwear: NUMERIC_SIZES,
  Shirt: NUMERIC_SIZES,
  "T-shirt": NUMERIC_SIZES,
  Shoes: FREE_ONLY,
  Bag: FREE_ONLY,
  Watch: FREE_ONLY,
  Accessories: FREE_ONLY,
  Eyewear: FREE_ONLY,
  Other: ALL_SIZES,
};

// The default orderable-size set for a category. Unknown/empty category → all sizes.
export function defaultOrderableSizes(category: string | null | undefined): string[] {
  if (!category) return [...ALL_SIZES];
  return [...(ORDERABLE_SIZE_DEFAULTS[category] ?? ALL_SIZES)];
}

export const ACCESSORY_COMPOSITIONS = [
  "銀925-SILVER925",
  "錫-TIN + 銀925-SILVER925",
  "鉄-IRON",
  "ﾁﾀﾝ-TITANIUM + 銀925-SILVER925",
  "ｽﾃｨｰﾙ-STAINLESS STEEL + 銀925-SILVER925",
  "ｽﾃｨｰﾙ-STAINLESS STEEL",
  "鉄-IRON + 銀925-SILVER925",
  "ｱﾙﾐﾆｳﾑ-ALUMINIUM + 銀925-SILVER925",
  "水牛角-BUFFALO HORN + 銀925-SILVER925",
] as const;
