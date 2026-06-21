import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SupplierNewModal } from "@/components/supplier-new-modal";
import { createSupplier } from "@/app/actions/suppliers";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, primary_name, primary_title, country")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
        <SupplierNewModal action={createSupplier} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Primary Contact</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers?.map((s) => {
              const contact = [s.primary_name, s.primary_title].filter(Boolean).join(" / ");
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{contact || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{s.country ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/suppliers/${s.id}/edit`}
                      className="text-gray-500 hover:text-gray-900 text-xs underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!suppliers?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No suppliers
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
