import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductCostForm } from "@/components/product-cost-form";

const MATERIAL_SELECT =
  "id, material_number, name, color, category, set_price_jpy, unit_type, " +
  "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
  "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, seasons(name)";

export default async function ProductCostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [productResult, allMaterialsResult, productMaterialsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, product_category, " +
        "main_material_id, main_m_name, main_m_color, main_m_quantity, " +
        "lining_material_id, lining_m_name, lining_m_color, lining_m_quantity, " +
        "cost_eur_rate, markup_rate, retail_rate, retail_price_eur, " +
        "cutting_cost_jpy, sewing_cost_jpy, knitting_cost_jpy, " +
        "thread_cost_jpy, finish_cost_jpy, packing_cost_jpy, " +
        "main_mat:materials!main_material_id(material_number, set_price_jpy, unit_type), " +
        "lining_mat:materials!lining_material_id(material_number, set_price_jpy, unit_type)"
      )
      .eq("id", id)
      .single(),
    supabase.from("materials").select(MATERIAL_SELECT).order("name"),
    supabase.from("product_materials").select("material_id, usage_amount, material_group").eq("product_id", id),
  ]);

  const p = productResult.data as any;
  if (!p?.id) notFound();

  const mainMat = p.main_material_id && p.main_m_name
    ? {
        id: p.main_material_id,
        materialNumber: p.main_mat?.material_number ?? null,
        name: p.main_m_name,
        color: p.main_m_color ?? null,
        setPriceJpy: Number(p.main_mat?.set_price_jpy ?? 0),
        unitType: p.main_mat?.unit_type ?? null,
      }
    : null;

  const liningMat = p.lining_material_id && p.lining_m_name
    ? {
        id: p.lining_material_id,
        materialNumber: p.lining_mat?.material_number ?? null,
        name: p.lining_m_name,
        color: p.lining_m_color ?? null,
        setPriceJpy: Number(p.lining_mat?.set_price_jpy ?? 0),
        unitType: p.lining_mat?.unit_type ?? null,
      }
    : null;

  const initialAdditionalRows = (productMaterialsResult.data ?? []).map((pm: any) => ({
    materialId: pm.material_id,
    quantity: Number(pm.usage_amount),
    role: pm.material_group ?? "accessories",
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <ProductCostForm
          productId={p.id}
          productCategory={p.product_category ?? null}
          mainMaterial={mainMat}
          liningMaterial={liningMat}
          initialMainQuantity={Number(p.main_m_quantity ?? 0)}
          initialLiningQuantity={Number(p.lining_m_quantity ?? 0)}
          allMaterials={(allMaterialsResult.data ?? []) as any}
          initialAdditionalRows={initialAdditionalRows}
          initialManufacturing={{
            cutting:  Number(p.cutting_cost_jpy),
            sewing:   Number(p.sewing_cost_jpy),
            knitting: Number(p.knitting_cost_jpy),
            thread:   Number(p.thread_cost_jpy),
            finish:   Number(p.finish_cost_jpy),
            packing:  Number(p.packing_cost_jpy),
          }}
          initialCostEurRate={Number(p.cost_eur_rate) || 160}
          initialMarkupRate={Number(p.markup_rate) || 3.0}
          initialRetailRate={Number(p.retail_rate) || 3.5}
          initialRetailPriceEur={Number(p.retail_price_eur)}
        />
      </div>

    </div>
  );
}
