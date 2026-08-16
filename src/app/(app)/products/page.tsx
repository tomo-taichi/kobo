import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductsList } from "@/components/products-list";
import { getListValues } from "@/lib/list-options";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ material?: string; model?: string; version?: string }> }) {
  const supabase = await createClient();
  const { material: materialFilter, model: modelFilter, version: versionFilter } = await searchParams;

  // Products can exceed Supabase's 1000-row per-request cap (1900+), so page through.
  const PRODUCT_SELECT =
    "id, product_number, name, model_name, model_version_id, product_category, product_sex, " +
    "is_sample, is_invalid, status, main_material_id, " +
    "wholesale_eur, retail_price_eur, markup_rate, retail_rate, " +
    "main_m_name, main_m_color, seasons(id, name), " +
    "product_colors(retail_price_eur, wholesale_eur, markup_rate, retail_rate, material_colors(color)), " +
    "product_tags(tag)";
  async function fetchAllProducts() {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("products").select(PRODUCT_SELECT).order("name").range(from, from + 999);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  const [seasonsResult, rawProducts, mainImagesResult] = await Promise.all([
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false }),
    fetchAllProducts(),
    supabase
      .from("product_images")
      .select("product_id, thumb_url, sort_order")
      .is("product_color_id", null)
      .order("sort_order"),
  ]);

  // Up to 2 main-photo thumbnails per product, in sort order.
  const mainThumbs = new Map<string, string[]>();
  for (const img of (mainImagesResult.data ?? []) as any[]) {
    const arr = mainThumbs.get(img.product_id) ?? [];
    if (arr.length < 2) arr.push(img.thumb_url);
    mainThumbs.set(img.product_id, arr);
  }
  const products = (rawProducts as any[]).map((p) => ({
    ...p,
    main_thumbs: mainThumbs.get(p.id) ?? [],
    tags: ((p.product_tags ?? []) as any[]).map((t) => t.tag),
  }));

  const tagOptions = await getListValues(supabase, "product_tag", []);

  // Optional filters: main material (Materials "Used in"), model, or a single version.
  let filteredProducts = products;
  let materialName: string | null = null;
  let modelName: string | null = null;
  let versionLabel: string | null = null;
  if (materialFilter) {
    filteredProducts = products.filter((p) => p.main_material_id === materialFilter);
    materialName = products.find((p) => p.main_material_id === materialFilter)?.main_m_name ?? null;
  } else if (modelFilter) {
    const [{ data: vers }, { data: mdl }] = await Promise.all([
      supabase.from("model_versions").select("id").eq("model_id", modelFilter),
      supabase.from("models").select("name").eq("id", modelFilter).single(),
    ]);
    const versionIds = new Set(((vers ?? []) as unknown as { id: string }[]).map((v) => v.id));
    filteredProducts = products.filter((p) => p.model_version_id && versionIds.has(p.model_version_id));
    modelName = (mdl as unknown as { name: string } | null)?.name ?? null;
  } else if (versionFilter) {
    filteredProducts = products.filter((p) => p.model_version_id === versionFilter);
    const { data: vinfo } = await supabase.from("model_versions").select("seasons(name), models(name)").eq("id", versionFilter).single();
    const vi = vinfo as unknown as { seasons: { name: string } | { name: string }[] | null; models: { name: string } | { name: string }[] | null } | null;
    const s = vi ? (Array.isArray(vi.seasons) ? vi.seasons[0]?.name : vi.seasons?.name) : null;
    const mn = vi ? (Array.isArray(vi.models) ? vi.models[0]?.name : vi.models?.name) : null;
    versionLabel = [mn, s].filter(Boolean).join(" · ") || "version";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <Link
          href="/products/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
        >
          + New Product
        </Link>
      </div>

      {materialFilter && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-indigo-800">
            Showing products with main material <b>{materialName ?? "—"}</b> ({filteredProducts.length})
          </span>
          <Link href="/products" className="text-indigo-600 hover:underline text-xs">Clear filter</Link>
        </div>
      )}

      {modelFilter && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-indigo-800">
            Showing products for model <b>{modelName ?? "—"}</b> ({filteredProducts.length})
          </span>
          <Link href="/products" className="text-indigo-600 hover:underline text-xs">Clear filter</Link>
        </div>
      )}

      {versionFilter && (
        <div className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-indigo-800">
            Showing products for version <b>{versionLabel ?? "—"}</b> ({filteredProducts.length})
          </span>
          <Link href="/products" className="text-indigo-600 hover:underline text-xs">Clear filter</Link>
        </div>
      )}

      <ProductsList
        products={filteredProducts as any}
        seasons={seasonsResult.data ?? []}
        tagOptions={tagOptions}
        initialCategory={materialFilter || modelFilter || versionFilter ? "" : "Coat"}
      />
    </div>
  );
}
