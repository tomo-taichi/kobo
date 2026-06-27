import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductsList } from "@/components/products-list";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [seasonsResult, productsResult, mainImagesResult] = await Promise.all([
    supabase.from("seasons").select("id, name").order("name"),
    supabase
      .from("products")
      .select(
        "id, product_number, name, model_name, product_category, product_sex, " +
        "is_sample, is_invalid, " +
        "wholesale_eur, retail_price_eur, " +
        "main_m_name, main_m_color, seasons(id, name), " +
        "product_colors(retail_price_eur, wholesale_eur, material_colors(color))"
      )
      .order("name"),
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
  const products = ((productsResult.data ?? []) as any[]).map((p) => ({
    ...p,
    main_thumbs: mainThumbs.get(p.id) ?? [],
  }));

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

      <ProductsList
        products={products as any}
        seasons={seasonsResult.data ?? []}
      />
    </div>
  );
}
