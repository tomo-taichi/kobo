export const PRODUCTION_STAGES = [
  { key: "pattern_done", label: "Pattern" },
  { key: "cut_done",     label: "Cut" },
  { key: "sew_done",     label: "Sew" },
  { key: "fin_done",     label: "Finish" },
  { key: "ready_done",   label: "Ready" },
] as const;

export type StageKey = typeof PRODUCTION_STAGES[number]["key"];
