import { createClient } from "@/lib/supabase/server";
import { MaterialNewModal } from "@/components/material-new-modal";
import { MaterialsClient } from "@/components/materials-client";
import { createMaterial } from "@/app/actions/materials";

export default async function MaterialsPage() {
  const supabase = await createClient();

  const [materialsResult, suppliersResult, seasonsResult] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, category, unit_price_jpy, set_price_jpy, unit_type, color, supplier_id, season_id, suppliers(name), seasons(name), comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, comp_4_label, comp_4_pct, comp_5_label, comp_5_pct, material_colors(color, unit_price_jpy, set_price_jpy, sort_order)")
      .order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
  ]);

  const rawMaterials = materialsResult.data ?? [];
  const suppliers = suppliersResult.data ?? [];
  const seasons   = seasonsResult.data ?? [];

  // Unique list of colours used in the past (across all material_colors)
  const pastColors = Array.from(
    new Set(rawMaterials.flatMap((m: any) => (m.material_colors ?? []).map((c: any) => c.color)).filter(Boolean))
  ) as string[];

  const materials = rawMaterials.map((m: any) => ({
    id:             m.id,
    name:           m.name,
    category:       m.category,
    unit_price_jpy: m.unit_price_jpy,
    set_price_jpy:  m.set_price_jpy,
    unit_type:      m.unit_type,
    color:          m.color,
    supplier_id:    m.supplier_id,
    season_id:      m.season_id,
    suppliers:      m.suppliers,
    seasons:        m.seasons,
    colors: ((m.material_colors ?? []) as any[])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((c: any) => ({
        color: c.color as string,
        unitPrice: c.unit_price_jpy != null ? Number(c.unit_price_jpy) : null,
        setPrice: c.set_price_jpy != null ? Number(c.set_price_jpy) : null,
      })),
    comps: [
      { label: m.comp_1_label, pct: m.comp_1_pct },
      { label: m.comp_2_label, pct: m.comp_2_pct },
      { label: m.comp_3_label, pct: m.comp_3_pct },
      { label: m.comp_4_label, pct: m.comp_4_pct },
      { label: m.comp_5_label, pct: m.comp_5_pct },
    ].filter((c) => c.label),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Materials</h1>
        <MaterialNewModal
          action={createMaterial}
          suppliers={suppliers}
          seasons={seasons}
          pastColors={pastColors}
        />
      </div>
      <MaterialsClient materials={materials} suppliers={suppliers} seasons={seasons} pastColors={pastColors} />
    </div>
  );
}
