// Customer Type (B2B/B2C) replaces the legacy 4-way group_type. See ADR-0007.
export const CUSTOMER_TYPES = ["B2B", "B2C"] as const;
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  B2B: "B2B",
  B2C: "B2C",
};
export const CUSTOMER_TYPE_COLOURS: Record<string, string> = {
  B2B: "bg-blue-50 text-blue-700",
  B2C: "bg-orange-50 text-orange-700",
};

// Document language (PDF text). Independent of currency.
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
] as const;

// deposit_terms still encodes the deposit on/off toggle:
//   Deposit_and_Production = deposit required, Production_Only = no deposit.
export const DEPOSIT_TERMS = ["Deposit_and_Production", "Production_Only"] as const;
export const DEPOSIT_TERMS_LABELS: Record<string, string> = {
  Deposit_and_Production: "Deposit + Production",
  Production_Only:        "Production Only",
};

// Legacy group_type — still written-through (derived from customer_type + currency) so
// the Phase-2 PDF code keeps working. Removed once the PDF/pricing pass migrates off it.
export const GROUP_TYPES = ["Domestic", "Overseas", "Personal", "Customer"] as const;
export const GROUP_TYPE_LABELS: Record<string, string> = {
  Domestic:  "Domestic",
  Overseas:  "Overseas",
  Personal:  "Personal",
  Customer:  "Customer",
};

export const COUNTRY_GROUPS: { label: string; countries: string[] }[] = [
  {
    label: "Asia",
    countries: [
      "Japan",
      "China",
      "Hong Kong",
      "South Korea",
      "Taiwan",
      "Singapore",
      "India",
      "Thailand",
      "Indonesia",
      "Saudi Arabia",
      "UAE",
      "Turkey",
    ],
  },
  {
    label: "Europe",
    countries: [
      "Germany",
      "France",
      "United Kingdom",
      "Italy",
      "Spain",
      "Netherlands",
      "Switzerland",
      "Belgium",
      "Sweden",
      "Norway",
      "Denmark",
      "Austria",
    ],
  },
  {
    label: "Americas",
    countries: ["United States", "Canada", "Brazil", "Mexico"],
  },
  {
    label: "Oceania",
    countries: ["Australia", "New Zealand"],
  },
];

export const FLAT_COUNTRIES: string[] = COUNTRY_GROUPS.flatMap((g) => g.countries);

// keep for any existing references
export const GDP_TOP20_COUNTRIES = FLAT_COUNTRIES;
