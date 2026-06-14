export const GROUP_TYPES = ["Domestic", "Overseas", "Personal", "Customer"] as const;
export const DEPOSIT_TERMS = ["Deposit_and_Production", "Production_Only"] as const;

export const GROUP_TYPE_LABELS: Record<string, string> = {
  Domestic:  "Domestic",
  Overseas:  "Overseas",
  Personal:  "Personal",
  Customer:  "Customer",
};

export const DEPOSIT_TERMS_LABELS: Record<string, string> = {
  Deposit_and_Production: "Deposit + Production",
  Production_Only:        "Production Only",
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
