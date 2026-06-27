"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveMaterialOrder(
  seasonId: string,
  materialColorId: string,
  materialId: string,
  sampleRemaining: number,
  orderQty: number,
  notes: string | null
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("material_orders")
    .upsert(
      { season_id: seasonId, material_color_id: materialColorId, material_id: materialId, sample_remaining: sampleRemaining, order_qty: orderQty, notes },
      { onConflict: "material_color_id,season_id" }
    );
  if (error) return error.message;
  revalidatePath(`/seasons/${seasonId}/material-orders`);
  return null;
}
