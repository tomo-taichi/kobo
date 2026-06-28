import { createClient } from "@/lib/supabase/server";
import { CustomerNewModal } from "@/components/customer-new-modal";
import { CustomersClient } from "@/components/customers-client";
import { createCustomer } from "@/app/actions/customers";
import { isBillingComplete, isShippingComplete } from "@/lib/customer-constants";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: rawCustomers } = await supabase
    .from("customers")
    .select("id, name, customer_type, is_vip, deposit_terms, currency, tax_included, billing_address, billing_city, billing_postcode, billing_country, shipping_address, shipping_city, shipping_postcode, shipping_country, contract_status, contract_start_date, contract_end_date")
    .order("name");

  const customers = (rawCustomers ?? []).map((c: any) => ({
    ...c,
    billing_complete: isBillingComplete(c),
    shipping_complete: isShippingComplete(c),
  }));

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
