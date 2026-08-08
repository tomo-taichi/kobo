import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "@/components/customer-form";
import { CustomerContractsSection, type ContractFile } from "@/components/customer-contracts";
import { updateCustomer } from "@/app/actions/customers";
import { getBankOptions } from "@/lib/banks";

export default async function CustomerInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, { data: rawContracts }, bankOptions] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("customer_contracts")
      .select("id, filename, storage_path, uploaded_at")
      .eq("customer_id", id)
      .order("uploaded_at", { ascending: false }),
    getBankOptions(supabase),
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
    <div className="space-y-4 max-w-5xl">
        <CustomerForm
          action={updateCustomer}
          bankOptions={bankOptions}
          initialData={{
            name:                s.name,
            customer_type:       s.customer_type,
            language:            s.language,
            is_vip:              s.is_vip,
            default_discount_rate: s.default_discount_rate,
            default_deposit_rate:  s.default_deposit_rate,
            portal_access:       s.portal_access,
            deposit_terms:       s.deposit_terms,
            currency:            s.currency,
            tax_included:        s.tax_included,
            bank:                s.bank,
            contract_status:     s.contract_status,
            contract_start_date: s.contract_start_date,
            contract_end_date:   s.contract_end_date,
            website:             s.website,
            payment_terms:       s.payment_terms,
            shipping_terms:      s.shipping_terms,
            sns:                 s.sns ?? [],
            contacts:            s.contacts ?? [],
            billing_company:     s.billing_company,
            billing_address:     s.billing_address,
            billing_city:        s.billing_city,
            billing_state:       s.billing_state,
            billing_postcode:    s.billing_postcode,
            billing_country:     s.billing_country,
            billing_email:       s.billing_email,
            billing_tel:         s.billing_tel,
            billing_vat:         s.billing_vat,
            billing_fax:         s.billing_fax,
            shipping_same:       s.shipping_same,
            shipping_fax:        s.shipping_fax,
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
          contractsSlot={<CustomerContractsSection customerId={s.id} contracts={contracts} />}
        />
    </div>
  );
}
