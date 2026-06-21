import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm } from "@/components/supplier-form";
import { updateSupplier } from "@/app/actions/suppliers";

export default async function SupplierEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("suppliers")
    .select("id, name, country, address, company_phone, primary_name, primary_title, primary_mobile, primary_email, secondary_name, secondary_title, secondary_mobile, secondary_email, notes")
    .eq("id", id)
    .single();

  if (!s) notFound();

  return (
    <div className="space-y-6">
      <Link href="/suppliers" className="text-sm text-gray-500 hover:text-gray-900">
        ← Suppliers
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Edit Supplier</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
        <SupplierForm
          action={updateSupplier}
          initial={{
            name: s.name,
            country: (s as any).country ?? "",
            address: (s as any).address ?? "",
            company_phone: (s as any).company_phone ?? "",
            primary_name: (s as any).primary_name ?? "",
            primary_title: (s as any).primary_title ?? "",
            primary_mobile: (s as any).primary_mobile ?? "",
            primary_email: (s as any).primary_email ?? "",
            secondary_name: (s as any).secondary_name ?? "",
            secondary_title: (s as any).secondary_title ?? "",
            secondary_mobile: (s as any).secondary_mobile ?? "",
            secondary_email: (s as any).secondary_email ?? "",
            notes: (s as any).notes ?? "",
          }}
          id={s.id}
        />
      </div>
    </div>
  );
}
