import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductPhotosManager, type ProductImage } from "@/components/product-photos-manager";

export default async function ProductPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [productResult, colorsResult, imagesResult] = await Promise.all([
    supabase.from("products").select("id, model_name").eq("id", id).single(),
    supabase
      .from("product_colors")
      .select("id, sort_order, material_colors(color)")
      .eq("product_id", id)
      .order("sort_order"),
    supabase
      .from("product_images")
      .select("id, product_color_id, web_url, thumb_url, sort_order")
      .eq("product_id", id)
      .order("sort_order"),
  ]);

  const p = productResult.data as any;
  if (!p?.id) notFound();

  const colors = (colorsResult.data ?? []).map((c: any) => ({
    id: c.id as string,
    color: (c.material_colors?.color as string) ?? "—",
  }));
  const images = (imagesResult.data ?? []) as ProductImage[];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <ProductPhotosManager productId={id} colors={colors} images={images} />
    </div>
  );
}
