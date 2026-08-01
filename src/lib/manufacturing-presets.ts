import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeManufacturingPresets, type ManufacturingHourPresets } from "@/lib/presets";

// ADR-0009 Phase 3 — read the manufacturing autofill presets from company_settings,
// normalised against the defaults (tolerant of a missing column / null value).
export async function getManufacturingPresets(supabase: SupabaseClient): Promise<ManufacturingHourPresets> {
  const { data } = await supabase
    .from("company_settings")
    .select("manufacturing_hour_presets")
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return normalizeManufacturingPresets((data as any)?.manufacturing_hour_presets);
}
