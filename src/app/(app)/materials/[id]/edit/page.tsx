import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MaterialForm } from "@/components/material-form";
import { updateMaterial } from "@/app/actions/materials";

export default async function MaterialEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [materialResult, suppliersResult, seasonsResult, pastColorsResult, materialColorsResult] = await Promise.all([
    supabase
      .from("materials")
      .select("id, name, category, unit_price_jpy, set_price_jpy, unit_type, supplier_id, season_id, color, comp_1_label, comp_1_pct, comp_2_label, comp_2_pct, comp_3_label, comp_3_pct, comp_4_label, comp_4_pct, comp_5_label, comp_5_pct")
      .eq("id", id)
      .single(),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("material_colors").select("color"),
    supabase.from("material_colors").select("color, set_price_jpy, sort_order").eq("material_id", id).order("sort_order"),
  ]);

  if (!materialResult.data) notFound();

  const m = materialResult.data as any;
  const suppliers  = suppliersResult.data ?? [];
  const seasons    = seasonsResult.data ?? [];
  const pastColors = Array.from(
    new Set((pastColorsResult.data ?? []).map((r: any) => r.color).filter(Boolean))
  ) as string[];
  const colors = (materialColorsResult.data ?? []).map((c: any) => ({
    color: c.color as string,
    set_price_jpy: c.set_price_jpy != null ? Number(c.set_price_jpy) : null,
  }));

  return (
    <div className="space-y-6">
      <Link href="/materials" className="text-sm text-gray-500 hover:text-gray-900">
        ← Materials
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Edit: {m.name}</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
        <MaterialForm
          action={updateMaterial}
          suppliers={suppliers}
          seasons={seasons}
          pastColors={pastColors}
          initialData={{
            name:           m.name,
            category:       m.category,
            unit_price_jpy: Number(m.unit_price_jpy),
            set_price_jpy:  Number(m.set_price_jpy),
            unit_type:      m.unit_type,
            supplier_id:    m.supplier_id,
            season_id:      m.season_id,
            color:          m.color ?? "",
            colors,
            comp_1_label: m.comp_1_label ?? "", comp_1_pct: m.comp_1_pct,
            comp_2_label: m.comp_2_label ?? "", comp_2_pct: m.comp_2_pct,
            comp_3_label: m.comp_3_label ?? "", comp_3_pct: m.comp_3_pct,
            comp_4_label: m.comp_4_label ?? "", comp_4_pct: m.comp_4_pct,
            comp_5_label: m.comp_5_label ?? "", comp_5_pct: m.comp_5_pct,
          }}
          id={m.id}
        />
      </div>
    </div>
  );
}
