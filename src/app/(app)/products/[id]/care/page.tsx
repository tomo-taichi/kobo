import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductCareForm } from "@/components/product-care-form";

export default async function ProductCarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: p } = await supabase
    .from("products")
    .select("id, cleaning_instruction, weight_g, hs_code, product_category, product_sex, main_m_comp1_label")
    .eq("id", id)
    .single();

  if (!p?.id) notFound();

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <ProductCareForm
          productId={p.id}
          initialCleaningInstruction={p.cleaning_instruction}
          initialWeightG={p.weight_g}
          initialHsCode={p.hs_code}
          productCategory={p.product_category}
          productSex={p.product_sex}
          mainComp1Label={p.main_m_comp1_label}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-medium text-gray-800 mb-4">Tag Print</h2>
        <div className="flex gap-2">
          <a href={`/api/products/${p.id}/product-tag`} target="_blank" rel="noreferrer"
            className="text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700">
            Product Tag PDF
          </a>
          <a href={`/api/products/${p.id}/composition-tag`} target="_blank" rel="noreferrer"
            className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
            Composition Tag PDF
          </a>
        </div>
      </div>
    </div>
  );
}
