import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductTabNav } from "@/components/product-tab-nav";
import { DeleteProductButton } from "@/components/delete-product-button";
import { DuplicateProductButton } from "@/components/duplicate-product-button";

export default async function ProductDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select("id, name, product_number")
    .eq("id", id)
    .single();
  if (!p?.id) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/products" className="text-sm text-gray-500 hover:text-gray-900">
          ← Products
        </Link>
        <div className="flex items-center gap-2">
          <DuplicateProductButton productId={id} />
          <DeleteProductButton productId={id} productName={p.name} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Product Name</p>
        <p className="text-2xl font-semibold text-gray-900">{p.name || "—"}</p>
        <p className="text-xs text-gray-400 mt-1">No. {p.product_number ?? p.id}</p>
      </div>
      <ProductTabNav id={id} />
      {children}
    </div>
  );
}
