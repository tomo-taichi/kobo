"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeManufacturingPresets } from "@/lib/presets";

// ADR-0009 Phase 3 (Settings) — pricing settings on the single company_settings row.
export async function updatePricingSettings(costEurRate: number, laborRate: number): Promise<string | null> {
  if (!(costEurRate > 0)) return "EUR rate must be greater than 0";
  if (!(laborRate > 0)) return "Labor rate must be greater than 0";

  const supabase = await createClient();
  const { data: row } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
  if (!row) return "No company settings row found";

  const { error } = await supabase
    .from("company_settings")
    .update({ cost_eur_rate_default: costEurRate, labor_rate_jpy_per_hour: laborRate })
    .eq("id", row.id);
  if (error) return error.message;

  revalidatePath("/settings");
  return null;
}

export async function updateManufacturingPresets(presets: unknown): Promise<string | null> {
  const normalized = normalizeManufacturingPresets(presets); // sanitise before storing

  const supabase = await createClient();
  const { data: row } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
  if (!row) return "No company settings row found";

  const { error } = await supabase
    .from("company_settings")
    .update({ manufacturing_hour_presets: normalized })
    .eq("id", row.id);
  if (error) return error.message;

  revalidatePath("/settings");
  return null;
}
