import { createClient } from "@/lib/supabase/server";
import { CustomerNewModal } from "@/components/customer-new-modal";
import { CustomersClient } from "@/components/customers-client";
import { createCustomer } from "@/app/actions/customers";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, group_type, deposit_terms, currency, billing_country, contract_status, contract_start_date, contract_end_date")
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <CustomerNewModal action={createCustomer} />
      </div>
      <CustomersClient customers={customers ?? []} />
    </div>
  );
}
