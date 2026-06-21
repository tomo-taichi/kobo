import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductionGrid } from "@/components/production-grid";
import { type StageKey } from "@/lib/production-constants";

export default async function ProductionProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = await params;
  const supabase = await createClient();

  const seasonResult = await supabase.from("seasons").select("name").eq("id", seasonId).single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const season: any = seasonResult.data;
  if (!season) notFound();

  const [productsResult, progressResult] = await Promise.all([
    supabase.from("products").select("id, name, product_number").eq("season_id", seasonId).eq("is_invalid", false).order("name"),
    supabase.from("production_progress").select("product_id, pattern_done, cut_done, sew_done, fin_done, ready_done").eq("season_id", seasonId),
  ]);

  const products = productsResult.data ?? [];
  const progressMap = new Map(
    (progressResult.data ?? []).map((p) => [p.product_id, p])
  );

  const rows = products.map((p) => {
    const prog = progressMap.get(p.id);
    return {
      productId: p.id,
      productName: p.name,
      productNumber: p.product_number,
      stages: {
        pattern_done: prog?.pattern_done ?? false,
        cut_done:     prog?.cut_done ?? false,
        sew_done:     prog?.sew_done ?? false,
        fin_done:     prog?.fin_done ?? false,
        ready_done:   prog?.ready_done ?? false,
      } as Record<StageKey, boolean>,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">← Season List</Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">Production Progress: {season.name}</h1>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <ProductionGrid seasonId={seasonId} rows={rows} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-medium text-gray-800 mb-4">Batch Tag Printing</h2>
        <div className="flex gap-2">
          <a
            href={`/api/seasons/${seasonId}/tags`}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Product Tags Batch PDF
          </a>
          <a
            href={`/api/seasons/${seasonId}/tags?type=composition`}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Composition Tags Batch PDF
          </a>
        </div>
      </div>
    </div>
  );
}
