import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductsList } from "@/components/products-list";
import { getListValues } from "@/lib/list-options";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ material?: string }> }) {
  const supabase = await createClient();
  const { material: materialFilter } = await searchParams;

  // Products can exceed Supabase's 1000-row per-request cap (1900+), so page through.
  const PRODUCT_SELECT =
    "id, product_number, name, model_name, product_category, product_sex, " +
    "is_sample, is_invalid, main_material_id, " +
    "wholesale_eur, retail_price_eur, " +
    "main_m_name, main_m_color, seasons(id, name), " +
    "product_colors(retail_price_eur, wholesale_eur, material_colors(color)), " +
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

  // Optional main-material filter (from the Materials list "Used in" icon).
  const filteredProducts = materialFilter ? products.filter((p) => p.main_material_id === materialFilter) : products;
  const materialName = materialFilter ? (products.find((p) => p.main_material_id === materialFilter)?.main_m_name ?? null) : null;

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

      <ProductsList
        products={filteredProducts as any}
        seasons={seasonsResult.data ?? []}
        tagOptions={tagOptions}
        initialCategory={materialFilter ? "" : "Coat"}
      />
    </div>
  );
}
