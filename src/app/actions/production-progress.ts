"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type StageKey } from "@/lib/production-constants";

export async function toggleProductionStage(
  productId: string,
  seasonId: string,
  stage: StageKey,
  value: boolean
) {
  const supabase = await createClient();
  await supabase
    .from("production_progress")
    .upsert(
      { product_id: productId, season_id: seasonId, [stage]: value },
      { onConflict: "product_id,season_id" }
    );
  revalidatePath(`/seasons/${seasonId}/production`);
}
