import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customer-form";
import { CustomerContractsSection, type ContractFile } from "@/components/customer-contracts";
import { updateCustomer } from "@/app/actions/customers";

export default async function CustomerInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, { data: rawContracts }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("customer_contracts")
      .select("id, filename, storage_path, uploaded_at")
      .eq("customer_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (!c) notFound();

  const contracts: ContractFile[] = await Promise.all(
    (rawContracts ?? []).map(async (row) => {
      const { data } = await supabase.storage
        .from("contracts")
        .createSignedUrl(row.storage_path, 3600);
      return { ...row, url: data?.signedUrl ?? null };
    })
  );

  const s = c as any;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <CustomerForm
          action={updateCustomer}
          initialData={{
            name:                s.name,
            group_type:          s.group_type,
            deposit_terms:       s.deposit_terms,
            currency:            s.currency,
            tax_included:        s.tax_included,
            bank:                s.bank,
            contract_status:     s.contract_status,
            contract_start_date: s.contract_start_date,
            contract_end_date:   s.contract_end_date,
            website:             s.website,
            sns:                 s.sns ?? [],
            billing_company:     s.billing_company,
            billing_address:     s.billing_address,
            billing_city:        s.billing_city,
            billing_state:       s.billing_state,
            billing_postcode:    s.billing_postcode,
            billing_country:     s.billing_country,
            billing_email:       s.billing_email,
            billing_tel:         s.billing_tel,
            billing_vat:         s.billing_vat,
            shipping_same:       s.shipping_same,
            shipping_name:       s.shipping_name,
            shipping_address:    s.shipping_address,
            shipping_city:       s.shipping_city,
            shipping_state:      s.shipping_state,
            shipping_postcode:   s.shipping_postcode,
            shipping_country:    s.shipping_country,
            shipping_tel:        s.shipping_tel,
            shipping_email:      s.shipping_email,
            shipping_vat:        s.shipping_vat,
            shipping_memo:       s.shipping_memo,
            forwarder:           s.forwarder,
            forwarder_account:   s.forwarder_account,
            shops:               s.shops ?? [],
          }}
          id={s.id}
        />
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <CustomerContractsSection customerId={s.id} contracts={contracts} />
      </div>
    </div>
  );
}
