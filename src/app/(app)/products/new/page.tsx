import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { createProduct } from "@/app/actions/products";

const MATERIAL_SELECT =
  "id, material_number, name, color, category, set_price_jpy, unit_type, " +
  "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
  "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, seasons(name)";

export default async function NewProductPage() {
  const supabase = await createClient();

  const [seasonsResult, pastModelsResult, materialsResult] = await Promise.all([
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("products").select("model_name").not("model_name", "is", null),
    supabase.from("materials").select(MATERIAL_SELECT).order("name"),
  ]);

  const pastModelNames = Array.from(
    new Set((pastModelsResult.data ?? []).map((r: any) => r.model_name).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6">
      <Link href="/products" className="text-sm text-gray-500 hover:text-gray-900">
        ← Products
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">New Product</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <ProductForm
          action={createProduct}
          seasons={seasonsResult.data ?? []}
          materials={(materialsResult.data ?? []) as any}
          pastModelNames={pastModelNames}
        />
      </div>
    </div>
  );
}
