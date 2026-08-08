import { createClient } from "@/lib/supabase/server";
import { SupplierNewModal } from "@/components/supplier-new-modal";
import { SuppliersClient } from "@/components/suppliers-client";
import { createSupplier } from "@/app/actions/suppliers";
import { getListValues, DEFAULT_SUPPLIER_COUNTRIES } from "@/lib/list-options";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const [{ data: suppliers }, { data: matRows }, countryOptions] = await Promise.all([
    supabase.from("suppliers").select("id, name, country, address, company_phone, primary_name, primary_title, primary_mobile, primary_email, secondary_name, secondary_title, secondary_mobile, secondary_email, notes, archived").order("name"),
    supabase.from("materials").select("supplier_id").not("supplier_id", "is", null),
    getListValues(supabase, "supplier_country", DEFAULT_SUPPLIER_COUNTRIES),
  ]);

  const matCounts = new Map<string, number>();
  for (const r of (matRows ?? []) as any[]) matCounts.set(r.supplier_id, (matCounts.get(r.supplier_id) ?? 0) + 1);
  const withCounts = (suppliers ?? []).map((s: any) => ({ ...s, material_count: matCounts.get(s.id) ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
        <SupplierNewModal action={createSupplier} countryOptions={countryOptions} />
      </div>

      <SuppliersClient suppliers={withCounts as any} countryOptions={countryOptions} />
    </div>
  );
}
