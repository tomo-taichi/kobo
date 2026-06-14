export const PRODUCTION_STAGES = [
  { key: "pattern_done", label: "型紙" },
  { key: "cut_done",     label: "裁断" },
  { key: "sew_done",     label: "縫製" },
  { key: "fin_done",     label: "仕上げ" },
  { key: "ready_done",   label: "出荷準備" },
] as const;

export type StageKey = typeof PRODUCTION_STAGES[number]["key"];
