import { createClient } from "@/lib/supabase/server";
import { CustomerNewModal } from "@/components/customer-new-modal";
import { CustomersClient } from "@/components/customers-client";
import { createCustomer } from "@/app/actions/customers";
import { getBankOptions } from "@/lib/banks";
import { isBillingComplete, isShippingComplete } from "@/lib/customer-constants";
import { getCurrentProfile } from "@/lib/auth";

export default async function CustomersPage() {
  const supabase = await createClient();
  const me = await getCurrentProfile();
  const canManageUsers = me?.userType === "internal" && me.isBrand;
  const [{ data: rawCustomers }, { data: orderRows }, { data: payRows }, bankOptions] = await Promise.all([
    supabase
      .from("customers")
      .select("id, legacy_id, name, customer_type, currency, billing_country, contract_status, tax_included, bank, " +
        "billing_address, billing_city, billing_postcode, billing_country, " +
        "shipping_same, shipping_address, shipping_city, shipping_postcode, shipping_country")
      .order("name"),
    supabase.from("orders").select("customer_id"),
    supabase.from("customer_payments").select("customer_id, order_id, type, amount"),
    getBankOptions(supabase),
  ]);

  // Orders per customer.
  const orderCounts = new Map<string, number>();
  for (const r of (orderRows ?? []) as any[]) orderCounts.set(r.customer_id, (orderCounts.get(r.customer_id) ?? 0) + 1);

  // Unpaid invoices per customer: orders whose debit (billed) exceeds credit (paid).
  const perOrder = new Map<string, { cust: string; bal: number }>();
  for (const p of (payRows ?? []) as any[]) {
    if (!p.order_id) continue;
    const cur = perOrder.get(p.order_id) ?? { cust: p.customer_id, bal: 0 };
    cur.bal += (p.type === "debit" ? 1 : p.type === "credit" ? -1 : 0) * Number(p.amount || 0);
    perOrder.set(p.order_id, cur);
  }
  const unpaidCounts = new Map<string, number>();
  for (const { cust, bal } of perOrder.values()) {
    if (bal > 0.01) unpaidCounts.set(cust, (unpaidCounts.get(cust) ?? 0) + 1);
  }

  const customers = (rawCustomers ?? []).map((c: any) => ({
    id: c.id, legacy_id: c.legacy_id, name: c.name, customer_type: c.customer_type,
    currency: c.currency, billing_country: c.billing_country, contract_status: c.contract_status,
    tax_included: c.tax_included, bank: c.bank,
    registered_complete: isBillingComplete(c) && (c.shipping_same || isShippingComplete(c)),
    order_count: orderCounts.get(c.id) ?? 0,
    unpaid_count: unpaidCounts.get(c.id) ?? 0,
  }));

  const bankLabels: Record<string, string> = Object.fromEntries(bankOptions.map((b) => [b.value, b.label]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
        <CustomerNewModal action={createCustomer} bankOptions={bankOptions} />
      </div>
      <CustomersClient customers={customers} bankLabels={bankLabels} canManageUsers={canManageUsers} />
    </div>
  );
}
