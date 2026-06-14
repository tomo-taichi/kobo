import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductsList } from "@/components/products-list";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [seasonsResult, productsResult] = await Promise.all([
    supabase.from("seasons").select("id, name").order("name"),
    supabase
      .from("products")
      .select(
        "id, product_number, name, model_name, product_category, product_sex, " +
        "is_sample, is_invalid, " +
        "wholesale_eur, set_ws_price_eur, retail_rate, retail_price_eur, " +
        "main_m_name, main_m_color, seasons(id, name)"
      )
      .order("name"),
  ]);

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
        products={(productsResult.data ?? []) as any}
        seasons={seasonsResult.data ?? []}
      />
    </div>
  );
}
