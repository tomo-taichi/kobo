"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GenerateBatchesResult =
  | { batches: number; linkedItems: number; skippedNoColour: number }
  | { error: string };

/**
 * ADR-0009 Phase 1 / Step 2 (decision D3).
 *
 * Groups a season's order lines by product_color and materialises one production_batch per
 * (season × product × colour), then links each order_item to its batch. Idempotent — safe to
 * re-run whenever orders change: the upsert only writes ordered_qty (and product_id), so a
 * batch's progress fields (priority, fabric_arrived, pattern/cut/sew/fin status) set later by
 * the production team are PRESERVED on re-run. Lines with no colour can't be batched and are
 * skipped (reported back).
 */
export async function generateProductionBatches(seasonId: string): Promise<GenerateBatchesResult> {
  const supabase = await createClient();

  // 1. All order lines in the season (filtered via their order), with colour + per-size quantities.
  const { data: items, error } = await supabase
    .from("order_items")
    .select("id, product_id, product_color_id, orders!inner(season_id), order_item_sizes(quantity)")
    .eq("orders.season_id", seasonId);
  if (error) return { error: error.message };

  // 2. Group by product_color_id; sum quantities; collect the line ids to link.
  type Group = { productId: string; qty: number; itemIds: string[] };
  const groups = new Map<string, Group>();
  let skippedNoColour = 0;
  for (const it of (items ?? []) as any[]) {
    const colourId = it.product_color_id as string | null;
    if (!colourId) { skippedNoColour++; continue; }
    const qty = (it.order_item_sizes ?? []).reduce((s: number, r: any) => s + (r.quantity ?? 0), 0);
    const g: Group = groups.get(colourId) ?? { productId: it.product_id, qty: 0, itemIds: [] };
    g.qty += qty;
    g.itemIds.push(it.id);
    groups.set(colourId, g);
  }

  if (groups.size === 0) {
    return { batches: 0, linkedItems: 0, skippedNoColour };
  }

  // 3. Upsert one batch per colour. Only ordered_qty/product_id are written, so existing
  //    progress fields survive re-runs (see doc comment).
  const rows = [...groups.entries()].map(([colourId, g]) => ({
    season_id: seasonId,
    product_id: g.productId,
    product_color_id: colourId,
    ordered_qty: g.qty,
  }));
  const { data: upserted, error: upErr } = await supabase
    .from("production_batches")
    .upsert(rows, { onConflict: "season_id,product_color_id" })
    .select("id, product_color_id");
  if (upErr) return { error: upErr.message };

  // 4. Link each order line to its batch.
  const batchByColour = new Map((upserted ?? []).map((b: any) => [b.product_color_id as string, b.id as string]));
  let linkedItems = 0;
  for (const [colourId, g] of groups) {
    const batchId = batchByColour.get(colourId);
    if (!batchId) continue;
    const { error: linkErr } = await supabase
      .from("order_items")
      .update({ production_batch_id: batchId })
      .in("id", g.itemIds);
    if (linkErr) return { error: linkErr.message };
    linkedItems += g.itemIds.length;
  }

  revalidatePath(`/seasons/${seasonId}/production`);
  revalidatePath(`/seasons/${seasonId}/production/kanban`);
  return { batches: groups.size, linkedItems, skippedNoColour };
}

// ADR-0009 Phase 3 — update a single field on a production batch from the Kanban.
// Handles stage statuses (auto-advance is derived, not stored), priority, and
// cutter/sewer assignees. Returns null on success or an error message.
export type BatchField =
  | "fabric_arrived"
  | "pattern_state"
  | "cut_status"
  | "sew_status"
  | "fin_status"
  | "priority"
  | "cutter_name"
  | "sewer_name"
  | "fin_tape"
  | "fin_button"
  | "fin_buttonhole"
  | "fin_handsew"
  | "fin_wash"
  | "fin_tag"
  | "fin_comment";

export async function updateBatchField(
  batchId: string,
  seasonId: string,
  field: BatchField,
  value: string | number | boolean | null
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("production_batches").update({ [field]: value }).eq("id", batchId);
  if (error) return error.message;
  revalidatePath(`/seasons/${seasonId}/production/kanban`);
  revalidatePath(`/seasons/${seasonId}/production/finishing`);
  return null;
}
