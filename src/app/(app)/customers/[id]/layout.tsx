import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerTabNav } from "@/components/customer-tab-nav";

export default async function CustomerDetailLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("customers")
    .select("name, contract_status")
    .eq("id", id)
    .single();

  if (!c) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-sm text-gray-500 hover:text-gray-900">
          ← Customers
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">{c.name}</h1>
      </div>
      <CustomerTabNav id={id} />
      {children}
    </div>
  );
}
