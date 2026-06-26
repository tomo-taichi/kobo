import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/product-form";
import { updateProduct } from "@/app/actions/products";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const MATERIAL_SELECT =
    "id, name, color, category, material_number, set_price_jpy, unit_type, " +
    "comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, " +
    "comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, " +
    "colors:material_colors(id, color), seasons(name)";

  const [productResult, seasonsResult, pastModelsResult, materialsResult, productColorsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, season_id, model_name, is_sample, is_invalid, " +
        "product_category, product_sex, " +
        "main_material_id, main_m_category, main_m_name, main_m_color, " +
        "main_m_comp1_label, main_m_comp1_pct, main_m_comp2_label, main_m_comp2_pct, " +
        "main_m_comp3_label, main_m_comp3_pct, main_m_comp4_label, main_m_comp4_pct, " +
        "main_m_comp5_label, main_m_comp5_pct, " +
        "lining_material_id, lining_m_category, lining_m_name, lining_m_color, lining_material_color_id, " +
        "lining_m_comp1_label, lining_m_comp1_pct, lining_m_comp2_label, lining_m_comp2_pct, " +
        "lining_m_comp3_label, lining_m_comp3_pct, lining_m_comp4_label, lining_m_comp4_pct, " +
        "lining_m_comp5_label, lining_m_comp5_pct, " +
        "accessory_composition"
      )
      .eq("id", id)
      .single(),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("products").select("model_name").not("model_name", "is", null),
    supabase.from("materials").select(MATERIAL_SELECT).order("name"),
    supabase.from("product_colors").select("material_color_id, sort_order").eq("product_id", id).order("sort_order"),
  ]);

  const p = productResult.data as any;
  if (!p?.id) notFound();

  const allMaterials = (materialsResult.data ?? []) as any[];
  const findMaterialNumber = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return allMaterials.find((m) => m.id === id)?.material_number ?? null;
  };

  const pastModelNames = Array.from(
    new Set((pastModelsResult.data ?? []).map((r: any) => r.model_name).filter(Boolean))
  ) as string[];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <ProductForm
        action={updateProduct}
        seasons={seasonsResult.data ?? []}
        materials={allMaterials}
        pastModelNames={pastModelNames}
        initialData={{
          season_id:            p.season_id,
          model_name:           p.model_name ?? "",
          product_category:     p.product_category ?? undefined,
          product_sex:          p.product_sex ?? undefined,
          is_sample:            p.is_sample,
          is_invalid:           p.is_invalid,
          main_material_id:     p.main_material_id ?? undefined,
          main_m_category:      p.main_m_category ?? undefined,
          main_m_name:          p.main_m_name ?? undefined,
          main_m_color:         p.main_m_color ?? undefined,
          main_m_comp1_label:   p.main_m_comp1_label ?? undefined,
          main_m_comp1_pct:     p.main_m_comp1_pct ?? undefined,
          main_m_comp2_label:   p.main_m_comp2_label ?? undefined,
          main_m_comp2_pct:     p.main_m_comp2_pct ?? undefined,
          main_m_comp3_label:   p.main_m_comp3_label ?? undefined,
          main_m_comp3_pct:     p.main_m_comp3_pct ?? undefined,
          main_m_comp4_label:   p.main_m_comp4_label ?? undefined,
          main_m_comp4_pct:     p.main_m_comp4_pct ?? undefined,
          main_m_comp5_label:   p.main_m_comp5_label ?? undefined,
          main_m_comp5_pct:     p.main_m_comp5_pct ?? undefined,
          lining_material_id:   p.lining_material_id ?? undefined,
          lining_m_category:    p.lining_m_category ?? undefined,
          lining_m_name:        p.lining_m_name ?? undefined,
          lining_m_color:       p.lining_m_color ?? undefined,
          lining_m_comp1_label: p.lining_m_comp1_label ?? undefined,
          lining_m_comp1_pct:   p.lining_m_comp1_pct ?? undefined,
          lining_m_comp2_label: p.lining_m_comp2_label ?? undefined,
          lining_m_comp2_pct:   p.lining_m_comp2_pct ?? undefined,
          lining_m_comp3_label: p.lining_m_comp3_label ?? undefined,
          lining_m_comp3_pct:   p.lining_m_comp3_pct ?? undefined,
          lining_m_comp4_label: p.lining_m_comp4_label ?? undefined,
          lining_m_comp4_pct:   p.lining_m_comp4_pct ?? undefined,
          lining_m_comp5_label: p.lining_m_comp5_label ?? undefined,
          lining_m_comp5_pct:   p.lining_m_comp5_pct ?? undefined,
          accessory_composition:  p.accessory_composition ?? undefined,
          main_material_number:   findMaterialNumber(p.main_material_id),
          lining_material_number: findMaterialNumber(p.lining_material_id),
          lining_material_color_id: p.lining_material_color_id ?? null,
          enabled_color_ids:      (productColorsResult.data ?? []).map((r: any) => r.material_color_id as string),
        }}
        id={p.id}
      />
    </div>
  );
}
