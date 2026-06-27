"use client";

import { useActionState, useState } from "react";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, LANGUAGES, COUNTRY_GROUPS, FLAT_COUNTRIES } from "@/lib/customer-constants";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Shop = { name: string; address: string };
type SnsEntry = { platform: string; url: string };

type InitialData = {
  name?: string;
  customer_type?: string;
  language?: string;
  is_vip?: boolean;
  default_discount_rate?: number | null;
  default_deposit_rate?: number | null;
  portal_access?: boolean;
  deposit_terms?: string;
  currency?: string;
  tax_included?: boolean;
  bank?: string;
  contract_status?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  website?: string;
  sns?: SnsEntry[];
  billing_company?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  billing_tel?: string;
  billing_email?: string;
  billing_vat?: string;
  shipping_same?: boolean;
  shipping_name?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  shipping_tel?: string;
  shipping_email?: string;
  shipping_vat?: string;
  shipping_memo?: string;
  forwarder?: string;
  forwarder_account?: string;
  shops?: Shop[];
};

type Props = {
  action: Action;
  initialData?: InitialData;
  id?: string;
  onCancel?: () => void;
};

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
const selectCls = inputCls + " bg-white";

// Grouped country select + optional free-text fallback
function CountrySelect({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isCustom = value !== "" && !FLAT_COUNTRIES.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value === "__other__") {
      setShowCustom(true);
      onChange("");
    } else {
      setShowCustom(false);
      onChange(e.target.value);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={showCustom ? "__other__" : value}
        onChange={handleSelect}
        className={selectCls}
      >
        <option value="">—</option>
        {COUNTRY_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </optgroup>
        ))}
        <option value="__other__">Other (manual input)...</option>
      </select>
      {showCustom ? (
        <input
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter country name..."
          className={inputCls}
          autoFocus
        />
      ) : (
        <input type="hidden" name={name} value={value} />
      )}
    </div>
  );
}

const FORWARDERS     = ["EMS", "FedEx", "UPS", "DHL", "TNT"] as const;
const SNS_PLATFORMS  = ["Instagram", "X (Twitter)", "Facebook", "TikTok", "LINE", "WeChat", "YouTube", "Other"] as const;
const CONTRACT_STATUSES = [
  { value: "Active",     label: "Active" },
  { value: "Terminated", label: "Terminated" },
  { value: "On Hold",    label: "On Hold" },
] as const;
const MAX_SHOPS = 10;
const MAX_SNS   = 8;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function CustomerForm({ action, initialData = {}, id, onCancel }: Props) {
  const [error, formAction, pending] = useActionState(action, null);

  // Customer Type drives conditional fields (VIP, discount) and deposit/portal defaults.
  const [customerType, setCustomerType] = useState(initialData.customer_type ?? "");
  const [isVip, setIsVip] = useState(initialData.is_vip ?? false);
  const [depositRequired, setDepositRequired] = useState(
    (initialData.deposit_terms ?? "Deposit_and_Production") === "Deposit_and_Production"
  );
  const [depositPct, setDepositPct] = useState<number>(
    initialData.default_deposit_rate != null ? Math.round(initialData.default_deposit_rate * 100) : 30
  );
  const [depositTouched, setDepositTouched] = useState(false);
  const [discountPct, setDiscountPct] = useState<number>(
    initialData.default_discount_rate != null ? Math.round(initialData.default_discount_rate * 100) : 0
  );
  const [portalAccess, setPortalAccess] = useState<boolean>(initialData.portal_access ?? false);
  const [portalTouched, setPortalTouched] = useState(false);

  const clampPct = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

  function handleTypeChange(next: string) {
    setCustomerType(next);
    const vipAfter = next === "B2B" ? false : isVip;
    if (next === "B2B") setIsVip(false);
    if (!depositTouched) setDepositPct(next === "B2C" ? 100 : 30);
    if (!portalTouched) setPortalAccess(next === "B2B" || vipAfter);
  }
  function handleVipChange(v: boolean) {
    setIsVip(v);
    if (!portalTouched) setPortalAccess(customerType === "B2B" || v);
  }

  const numCls = "w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900";

  const [shippingSame, setShippingSame] = useState(initialData.shipping_same ?? false);
  const [shops, setShops] = useState<Shop[]>(initialData.shops?.length ? initialData.shops : []);
  const [snsEntries, setSnsEntries] = useState<SnsEntry[]>(
    initialData.sns?.length ? initialData.sns : []
  );
  const [shippingCountry, setShippingCountry] = useState(initialData.shipping_country ?? "");

  const [billing, setBilling] = useState({
    company:  initialData.billing_company  ?? "",
    address:  initialData.billing_address  ?? "",
    city:     initialData.billing_city     ?? "",
    state:    initialData.billing_state    ?? "",
    postcode: initialData.billing_postcode ?? "",
    country:  initialData.billing_country  ?? "",
    tel:      initialData.billing_tel      ?? "",
    email:    initialData.billing_email    ?? "",
    vat:      initialData.billing_vat      ?? "",
  });

  function addShop() {
    if (shops.length < MAX_SHOPS) setShops((p) => [...p, { name: "", address: "" }]);
  }
  function removeShop(i: number) { setShops((p) => p.filter((_, idx) => idx !== i)); }
  function updateShop(i: number, field: keyof Shop, val: string) {
    setShops((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function addSns() {
    if (snsEntries.length < MAX_SNS) setSnsEntries((p) => [...p, { platform: SNS_PLATFORMS[0], url: "" }]);
  }
  function removeSns(i: number) { setSnsEntries((p) => p.filter((_, idx) => idx !== i)); }
  function updateSns(i: number, field: keyof SnsEntry, val: string) {
    setSnsEntries((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="shipping_same" value={shippingSame ? "true" : "false"} />
      <input type="hidden" name="shops" value={JSON.stringify(shops)} />
      <input type="hidden" name="sns" value={JSON.stringify(snsEntries)} />
      <input type="hidden" name="is_vip" value={customerType === "B2C" && isVip ? "true" : "false"} />
      <input type="hidden" name="deposit_terms" value={depositRequired ? "Deposit_and_Production" : "Production_Only"} />
      <input type="hidden" name="portal_access" value={portalAccess ? "true" : "false"} />
      <input type="hidden" name="default_deposit_pct" value={depositRequired ? depositPct : 0} />
      <input type="hidden" name="default_discount_pct" value={customerType === "B2C" && isVip ? discountPct : 0} />
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}

      {/* ── 1. Client Name ── */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Client Name <span className="text-red-500">*</span>
        </label>
        <input name="name" defaultValue={initialData.name ?? ""} required className={inputCls} placeholder="e.g. ABC Boutique" />
      </div>

      {/* ── 2. Must Info ── */}
      <Section title="Must Info">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer Type <span className="text-red-500">*</span></label>
            <select name="customer_type" value={customerType} onChange={(e) => handleTypeChange(e.target.value)} required className={selectCls}>
              <option value="">Select...</option>
              {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Document Language <span className="text-red-500">*</span></label>
            <select name="language" defaultValue={initialData.language ?? "en"} required className={selectCls}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
            <select name="currency" defaultValue={initialData.currency ?? "JPY"} required className={selectCls}>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tax <span className="text-red-500">*</span></label>
            <select name="tax_included" defaultValue={initialData.tax_included ? "true" : "false"} required className={selectCls}>
              <option value="false">No Tax</option>
              <option value="true">Tax Included</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bank <span className="text-red-500">*</span></label>
            <select name="bank" defaultValue={initialData.bank ?? ""} required className={selectCls}>
              <option value="">Select...</option>
              <option value="Rakuten_JP">Rakuten JP</option>
              <option value="WISE_EU">WISE EU</option>
            </select>
          </div>
        </div>

        {/* B2C: VIP flag + preset discount */}
        {customerType === "B2C" && (
          <div className="flex items-center gap-5 flex-wrap bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
              <input type="checkbox" checked={isVip} onChange={(e) => handleVipChange(e.target.checked)} className="w-4 h-4" />
              VIP
            </label>
            {isVip ? (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">VIP Discount Rate</label>
                <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(clampPct(e.target.value))} className={numCls} />
                <span className="text-xs text-gray-400">% off retail (pre-fills orders)</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Non-VIP B2C: retail price, 0% discount</span>
            )}
          </div>
        )}

        {/* Deposit on/off + default rate */}
        <div className="flex items-center gap-5 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
            <input type="checkbox" checked={depositRequired} onChange={(e) => setDepositRequired(e.target.checked)} className="w-4 h-4" />
            Deposit required
          </label>
          {depositRequired ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Default Deposit Rate</label>
              <input type="number" min="0" max="100" value={depositPct}
                onChange={(e) => { setDepositPct(clampPct(e.target.value)); setDepositTouched(true); }} className={numCls} />
              <span className="text-xs text-gray-400">% of total (pre-fills orders)</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">No deposit — full payment on delivery</span>
          )}
        </div>

        {/* B2B Portal access */}
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
          <input type="checkbox" checked={portalAccess}
            onChange={(e) => { setPortalAccess(e.target.checked); setPortalTouched(true); }} className="w-4 h-4" />
          B2B Portal access
          <span className="text-gray-400 font-normal">(default: B2B, or B2C marked VIP)</span>
        </label>

        {/* Contract */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract Status <span className="text-red-500">*</span></label>
            <select name="contract_status" defaultValue={initialData.contract_status ?? "Active"} required className={selectCls}>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract Start Date</label>
            <input
              type="date"
              name="contract_start_date"
              defaultValue={initialData.contract_start_date ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract End Date</label>
            <input
              type="date"
              name="contract_end_date"
              defaultValue={initialData.contract_end_date ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      {/* ── 3. Billing Address ── */}
      <Section title="Billing Address">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
          <input name="billing_company" value={billing.company} onChange={(e) => setBilling((p) => ({ ...p, company: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
          <input name="billing_address" value={billing.address} onChange={(e) => setBilling((p) => ({ ...p, address: e.target.value }))} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input name="billing_city" value={billing.city} onChange={(e) => setBilling((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">State / Region</label>
            <input name="billing_state" value={billing.state} onChange={(e) => setBilling((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
            <input name="billing_postcode" value={billing.postcode} onChange={(e) => setBilling((p) => ({ ...p, postcode: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
            <CountrySelect
              name="billing_country"
              value={billing.country}
              onChange={(v) => setBilling((p) => ({ ...p, country: v }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tel</label>
            <input name="billing_tel" value={billing.tel} onChange={(e) => setBilling((p) => ({ ...p, tel: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input name="billing_email" type="email" value={billing.email} onChange={(e) => setBilling((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">VAT Number</label>
          <input name="billing_vat" value={billing.vat} onChange={(e) => setBilling((p) => ({ ...p, vat: e.target.value }))} className={inputCls} />
        </div>
      </Section>

      {/* ── 4. Shipping Address ── */}
      <Section title="Shipping Address">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={shippingSame}
            onChange={(e) => setShippingSame(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <span className="text-xs text-gray-600">Same as Billing Address</span>
        </label>

        {!shippingSame && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shipping Name</label>
              <input name="shipping_name" defaultValue={initialData.shipping_name ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input name="shipping_address" defaultValue={initialData.shipping_address ?? ""} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input name="shipping_city" defaultValue={initialData.shipping_city ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State / Region</label>
                <input name="shipping_state" defaultValue={initialData.shipping_state ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
                <input name="shipping_postcode" defaultValue={initialData.shipping_postcode ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                <CountrySelect
                  name="shipping_country"
                  value={shippingCountry}
                  onChange={setShippingCountry}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tel</label>
                <input name="shipping_tel" defaultValue={initialData.shipping_tel ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input name="shipping_email" type="email" defaultValue={initialData.shipping_email ?? ""} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">VAT Number</label>
              <input name="shipping_vat" defaultValue={initialData.shipping_vat ?? ""} className={inputCls} />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shipping Memo</label>
          <textarea name="shipping_memo" defaultValue={initialData.shipping_memo ?? ""} rows={2} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Forwarder</label>
            <select name="forwarder" defaultValue={initialData.forwarder ?? ""} className={selectCls}>
              <option value="">— Select —</option>
              {FORWARDERS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Account No</label>
            <input name="forwarder_account" defaultValue={initialData.forwarder_account ?? ""} className={inputCls} />
          </div>
        </div>
      </Section>

      {/* ── 5. Online Presence ── */}
      <Section title="Online Presence">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
          <input name="website" type="url" defaultValue={initialData.website ?? ""} className={inputCls} placeholder="https://example.com" />
        </div>
        {snsEntries.map((entry, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={entry.platform}
              onChange={(e) => updateSns(i, "platform", e.target.value)}
              className="w-36 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {SNS_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              value={entry.url}
              onChange={(e) => updateSns(i, "url", e.target.value)}
              placeholder="URL or @handle"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              onClick={() => removeSns(i)}
              className="text-gray-300 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {snsEntries.length < MAX_SNS && (
          <button
            type="button"
            onClick={addSns}
            className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 w-fit"
          >
            + Add SNS
          </button>
        )}
      </Section>

      {/* ── 6. Shops ── */}
      <Section title={`Shops (${shops.length}/${MAX_SHOPS})`}>
        {shops.map((shop, i) => (
          <div key={i} className="flex gap-2 items-start border border-gray-100 rounded-lg p-3">
            <div className="flex-1 flex flex-col gap-2">
              <input
                value={shop.name}
                onChange={(e) => updateShop(i, "name", e.target.value)}
                placeholder={`Shop ${i + 1} Name`}
                className={inputCls}
              />
              <input
                value={shop.address}
                onChange={(e) => updateShop(i, "address", e.target.value)}
                placeholder="Address"
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={() => removeShop(i)}
              className="mt-2 text-gray-300 hover:text-red-500 text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {shops.length < MAX_SHOPS && (
          <button
            type="button"
            onClick={addShop}
            className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 w-fit"
          >
            + Add Shop
          </button>
        )}
        {shops.length === 0 && (
          <p className="text-xs text-gray-400">No shops added yet</p>
        )}
      </Section>

      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button type="submit" disabled={pending} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
          {pending ? "Saving..." : id ? "Update" : "Create"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
