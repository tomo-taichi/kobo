import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SeasonForm } from "@/components/season-form";
import { updateSeason } from "@/app/actions/seasons";

export default async function SeasonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name, eur_jpy_rate, created_at")
    .eq("id", id)
    .single();

  if (!season) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = season as any;

  const [{ count: productCount }, { count: orderCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("season_id", id),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("season_id", id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">
          ← Season List
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">{s.name}</h1>

      {/* Edit form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Season Info</h2>
        <SeasonForm
          action={updateSeason}
          initialName={s.name}
          initialExchangeRate={s.eur_jpy_rate ? Number(s.eur_jpy_rate) : null}
          id={s.id}
        />
      </div>

      {/* Related links */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-medium text-gray-800 mb-4">Related</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href={`/products?season_id=${id}`}
            className="flex flex-col items-center gap-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <span className="text-2xl font-semibold text-gray-800">{productCount ?? 0}</span>
            <span className="text-xs text-gray-500">Products</span>
          </Link>
          <Link
            href={`/orders?season_id=${id}`}
            className="flex flex-col items-center gap-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <span className="text-2xl font-semibold text-gray-800">{orderCount ?? 0}</span>
            <span className="text-xs text-gray-500">Orders</span>
          </Link>
          <Link
            href={`/seasons/${id}/production`}
            className="flex flex-col items-center gap-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <span className="text-xl text-gray-400">→</span>
            <span className="text-xs text-gray-500">Production Progress</span>
          </Link>
          <Link
            href={`/seasons/${id}/material-orders`}
            className="flex flex-col items-center gap-1 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <span className="text-xl text-gray-400">→</span>
            <span className="text-xs text-gray-500">Material Order</span>
          </Link>
        </div>
      </div>

      {/* Tag PDFs */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-medium text-gray-800 mb-4">Batch Tag Printing</h2>
        <div className="flex gap-2">
          <a
            href={`/api/seasons/${id}/tags`}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Product Tags Batch PDF
          </a>
          <a
            href={`/api/seasons/${id}/tags?type=composition`}
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
