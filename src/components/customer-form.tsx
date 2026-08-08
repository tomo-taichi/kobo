"use client";

import { useActionState, useState, useRef, startTransition, createContext, useContext } from "react";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, LANGUAGES, COUNTRY_GROUPS, FLAT_COUNTRIES, isAddressComplete } from "@/lib/customer-constants";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Shop = { name: string; address: string };
type SnsEntry = { platform: string; url: string };
type Contact = { name: string | null; jobTitle: string | null; email: string | null; mobile: string | null; phone: string | null };

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
  payment_terms?: string;
  shipping_terms?: string;
  sns?: SnsEntry[];
  contacts?: Contact[];
  billing_company?: string;
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postcode?: string;
  billing_country?: string;
  billing_tel?: string;
  billing_email?: string;
  billing_vat?: string;
  billing_fax?: string;
  shipping_same?: boolean;
  shipping_fax?: string;
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
  bankOptions?: { value: string; label: string }[];
  contractsSlot?: React.ReactNode;
};

const DEFAULT_BANK_OPTIONS = [
  { value: "Rakuten_JP", label: "Rakuten JP" },
  { value: "WISE_EU", label: "WISE EU" },
];

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed";
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
  { value: "Archived", label: "Archived" },
] as const;
const MAX_SHOPS = 10;
const MAX_SNS   = 8;
const MAX_CONTACTS = 6;

// The currently-selected section (side-menu). Panels for other sections stay
// MOUNTED (hidden via CSS) so their inputs remain in the form — otherwise
// auto-save would submit missing fields and wipe that section's data.
const SectionCtx = createContext<string>("setting");

function PanelSection({ id, title, badge, children }: { id: string; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  const active = useContext(SectionCtx);
  return (
    <div className={active === id ? "border border-gray-200 rounded-lg bg-white p-4" : "hidden"}>
      <div className="flex items-center gap-2 border-b border-gray-100 pb-1 mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        {badge}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

// Complete / Incomplete pill for the Billing / Shipping section headers.
function StatusBadge({ ok }: { ok: boolean }) {
  return ok
    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">Complete</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">Incomplete</span>;
}

export function CustomerForm({ action, initialData = {}, id, onCancel, bankOptions = DEFAULT_BANK_OPTIONS, contractsSlot }: Props) {
  const [result, formAction, pending] = useActionState(action, null);
  const isError = result && result !== "ok";

  // Auto-save (edit mode only): debounced requestSubmit on any field change.
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleSubmit(delay: number) {
    if (!id) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Dispatch the action directly with a FormData snapshot instead of
    // form.requestSubmit(): native submission makes React 19 auto-reset the form,
    // which reverts the field you just edited. Direct dispatch keeps state intact.
    debounceRef.current = setTimeout(() => {
      const form = formRef.current;
      // useActionState's dispatch must run inside a transition.
      if (form) startTransition(() => formAction(new FormData(form)));
    }, delay);
  }
  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    if (!id) return;
    const t = e.target as HTMLElement;
    const typed = t instanceof HTMLInputElement &&
      ["text", "number", "email", "url", "date", ""].includes(t.type);
    const textarea = t instanceof HTMLTextAreaElement;
    scheduleSubmit(typed || textarea ? 900 : 250);
  }

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

  // Customer Setting fields are controlled (submitted via hidden inputs) so they survive
  // being locked/disabled. On the detail page they're locked until "Change" is pressed.
  const [language, setLanguage] = useState(initialData.language ?? "en");
  const [currency, setCurrency] = useState(initialData.currency ?? "JPY");
  const [taxIncluded, setTaxIncluded] = useState(initialData.tax_included ?? false);
  const [bank, setBank] = useState(initialData.bank ?? "");
  const [contractStatus, setContractStatus] = useState(initialData.contract_status ?? "Active");
  const [contractStart, setContractStart] = useState(initialData.contract_start_date ?? "");
  const [contractEnd, setContractEnd] = useState(initialData.contract_end_date ?? "");
  const [locked, setLocked] = useState(true);
  const editable = !id || !locked; // create flow is always editable; detail locks until "Change"

  const clampPct = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

  function handleTypeChange(next: string) {
    setCustomerType(next);
    if (next === "B2B") setIsVip(false);
    // Create flow only: pre-fill sensible deposit/portal defaults. When editing an
    // existing customer, reclassifying must NOT silently change their deposit rate,
    // portal access or currency — only the type itself changes.
    if (!id) {
      const vipAfter = next === "B2B" ? false : isVip;
      if (!depositTouched) setDepositPct(next === "B2C" ? 100 : 30);
      if (!portalTouched) setPortalAccess(next === "B2B" || vipAfter);
    }
  }
  function handleVipChange(v: boolean) {
    setIsVip(v);
    if (!portalTouched) setPortalAccess(customerType === "B2B" || v);
  }

  const numCls = "w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed";

  const [activeSection, setActiveSection] = useState("setting");
  const [shippingSame, setShippingSame] = useState(initialData.shipping_same ?? false);
  const [shops, setShops] = useState<Shop[]>(initialData.shops?.length ? initialData.shops : []);
  const [snsEntries, setSnsEntries] = useState<SnsEntry[]>(
    initialData.sns?.length ? initialData.sns : []
  );
  const [contacts, setContacts] = useState<Contact[]>(initialData.contacts?.length ? initialData.contacts : []);
  const [paymentTerms, setPaymentTerms] = useState(initialData.payment_terms ?? "");
  const [shippingTerms, setShippingTerms] = useState(initialData.shipping_terms ?? "");
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
    fax:      initialData.billing_fax      ?? "",
  });

  const [shipping, setShipping] = useState({
    name:     initialData.shipping_name     ?? "",
    address:  initialData.shipping_address  ?? "",
    city:     initialData.shipping_city     ?? "",
    state:    initialData.shipping_state    ?? "",
    postcode: initialData.shipping_postcode ?? "",
    country:  initialData.shipping_country  ?? "",
    tel:      initialData.shipping_tel      ?? "",
    email:    initialData.shipping_email    ?? "",
    vat:      initialData.shipping_vat      ?? "",
    fax:      initialData.shipping_fax      ?? "",
  });

  // Address completeness (live) — gates document generation. shipping_same → inherits billing.
  const billingComplete = isAddressComplete(billing);
  const shippingComplete = shippingSame ? billingComplete : isAddressComplete(shipping);

  function addShop() {
    if (shops.length < MAX_SHOPS) setShops((p) => [...p, { name: "", address: "" }]);
  }
  function removeShop(i: number) { setShops((p) => p.filter((_, idx) => idx !== i)); scheduleSubmit(250); }
  function updateShop(i: number, field: keyof Shop, val: string) {
    setShops((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function addSns() {
    if (snsEntries.length < MAX_SNS) setSnsEntries((p) => [...p, { platform: SNS_PLATFORMS[0], url: "" }]);
  }
  function removeSns(i: number) { setSnsEntries((p) => p.filter((_, idx) => idx !== i)); scheduleSubmit(250); }
  function updateSns(i: number, field: keyof SnsEntry, val: string) {
    setSnsEntries((p) => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  }

  function addContact() {
    if (contacts.length < MAX_CONTACTS) setContacts((p) => [...p, { name: "", jobTitle: "", email: "", mobile: "", phone: "" }]);
  }
  function removeContact(i: number) { setContacts((p) => p.filter((_, idx) => idx !== i)); scheduleSubmit(250); }
  function updateContact(i: number, field: keyof Contact, val: string) {
    setContacts((p) => p.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  }

  const sections = [
    { id: "setting", label: "Customer Setting" },
    { id: "contacts", label: "Contacts" },
    { id: "billing", label: "Billing Address" },
    { id: "shipping", label: "Shipping Address" },
    { id: "other", label: "Other Info" },
    ...(contractsSlot ? [{ id: "contracts", label: "Contracts" }] : []),
  ];

  return (
    <form action={formAction} ref={formRef} onChange={handleFormChange} className="flex flex-col gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="shipping_same" value={shippingSame ? "true" : "false"} />
      <input type="hidden" name="shops" value={JSON.stringify(shops)} />
      <input type="hidden" name="sns" value={JSON.stringify(snsEntries)} />
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
      <input type="hidden" name="is_vip" value={customerType === "B2C" && isVip ? "true" : "false"} />
      <input type="hidden" name="deposit_terms" value={depositRequired ? "Deposit_and_Production" : "Production_Only"} />
      <input type="hidden" name="portal_access" value={portalAccess ? "true" : "false"} />
      <input type="hidden" name="default_deposit_pct" value={depositRequired ? depositPct : 0} />
      <input type="hidden" name="default_discount_pct" value={customerType === "B2C" && isVip ? discountPct : 0} />
      {/* Customer Setting fields submit via these hidden inputs (visible controls are name-less + lockable). */}
      <input type="hidden" name="customer_type" value={customerType} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="tax_included" value={taxIncluded ? "true" : "false"} />
      <input type="hidden" name="bank" value={bank} />
      <input type="hidden" name="contract_status" value={contractStatus} />
      <input type="hidden" name="contract_start_date" value={contractStart} />
      <input type="hidden" name="contract_end_date" value={contractEnd} />
      {isError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{result}</p>}

      {/* ── 1. Client Name ── */}
      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Client Name <span className="text-red-500">*</span>
        </label>
        <input name="name" defaultValue={initialData.name ?? ""} required className={inputCls} placeholder="e.g. ABC Boutique" />
      </div>

      {/* Side-menu layout to cut scrolling: pick a section on the left; panels stay
          mounted (hidden) so auto-save keeps every section's fields. */}
      <div className="flex gap-4 items-start">
        <nav className="w-40 shrink-0 flex flex-col gap-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s.id ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <SectionCtx.Provider value={activeSection}>
        <div className="flex-1 min-w-0">

      {/* ── Customer Setting ── */}
      <PanelSection
        id="setting"
        title="Customer Setting (MUST)"
        badge={id ? (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${editable ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
            {editable ? "Editing" : "🔒 Locked"}
          </span>
        ) : undefined}
      >
        {id && (
          editable ? (
            <div className="flex justify-end -mt-1">
              <button type="button" onClick={() => setLocked(true)}
                className="text-[11px] text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2.5 py-1">
                Lock settings
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 -mt-1">
              <span className="text-xs text-amber-800">
                🔒 Locked to prevent accidental changes. Click “Change settings” to edit
                Customer Type, Language, Bank, Currency, Tax &amp; Contract.
              </span>
              <button type="button" onClick={() => setLocked(false)}
                className="text-xs font-medium px-2.5 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 shrink-0">
                Change settings
              </button>
            </div>
          )
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Customer Type <span className="text-red-500">*</span></label>
            <select value={customerType} onChange={(e) => handleTypeChange(e.target.value)} disabled={!editable} className={selectCls}>
              <option value="">Select...</option>
              {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Document Language <span className="text-red-500">*</span></label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={!editable} className={selectCls}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!editable} className={selectCls}>
              <option value="JPY">JPY (¥)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tax <span className="text-red-500">*</span></label>
            <select value={taxIncluded ? "true" : "false"} onChange={(e) => setTaxIncluded(e.target.value === "true")} disabled={!editable} className={selectCls}>
              <option value="false">No Tax</option>
              <option value="true">Tax Included</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bank <span className="text-red-500">*</span></label>
            <select value={bank} onChange={(e) => setBank(e.target.value)} disabled={!editable} className={selectCls}>
              <option value="">Select...</option>
              {bankOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              {/* keep a legacy value selectable even if its bank was removed */}
              {bank && !bankOptions.some((o) => o.value === bank) && <option value={bank}>{bank}</option>}
            </select>
          </div>
        </div>

        {/* B2C: VIP flag + preset discount */}
        {customerType === "B2C" && (
          <div className="flex items-center gap-5 flex-wrap bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
              <input type="checkbox" checked={isVip} disabled={!editable} onChange={(e) => handleVipChange(e.target.checked)} className="w-4 h-4" />
              VIP
            </label>
            {isVip ? (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">VIP Discount Rate</label>
                <input type="number" min="0" max="100" value={discountPct} disabled={!editable} onChange={(e) => setDiscountPct(clampPct(e.target.value))} className={numCls} />
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
            <input type="checkbox" checked={depositRequired} disabled={!editable} onChange={(e) => setDepositRequired(e.target.checked)} className="w-4 h-4" />
            Deposit required
          </label>
          {depositRequired ? (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Default Deposit Rate</label>
              <input type="number" min="0" max="100" value={depositPct} disabled={!editable}
                onChange={(e) => { setDepositPct(clampPct(e.target.value)); setDepositTouched(true); }} className={numCls} />
              <span className="text-xs text-gray-400">% of total (pre-fills orders)</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">No deposit — full payment on delivery</span>
          )}
        </div>

        {/* B2B Portal access */}
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 select-none">
          <input type="checkbox" checked={portalAccess} disabled={!editable}
            onChange={(e) => { setPortalAccess(e.target.checked); setPortalTouched(true); }} className="w-4 h-4" />
          B2B Portal access
          <span className="text-gray-400 font-normal">(default: B2B, or B2C marked VIP)</span>
        </label>

        {/* Contract */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract Status <span className="text-red-500">*</span></label>
            <select value={contractStatus} onChange={(e) => setContractStatus(e.target.value)} disabled={!editable} className={selectCls}>
              {CONTRACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract Start Date</label>
            <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} disabled={!editable} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contract End Date</label>
            <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} disabled={!editable} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms</label>
          <textarea name="payment_terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} rows={3} className={inputCls} placeholder="e.g. 30% deposit required by ..." />
        </div>
      </PanelSection>

      {/* ── Contacts ── */}
      <PanelSection
        id="contacts"
        title="Contacts"
        badge={<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">{contacts.length}</span>}
      >
        {contacts.map((c, i) => (
          <div key={i} className="border border-gray-100 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Contact {i + 1}</span>
              <button type="button" onClick={() => removeContact(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={c.name ?? ""} onChange={(e) => updateContact(i, "name", e.target.value)} placeholder="Name" className={inputCls} />
              <input value={c.jobTitle ?? ""} onChange={(e) => updateContact(i, "jobTitle", e.target.value)} placeholder="Job title" className={inputCls} />
            </div>
            <input value={c.email ?? ""} type="email" onChange={(e) => updateContact(i, "email", e.target.value)} placeholder="Email" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={c.mobile ?? ""} onChange={(e) => updateContact(i, "mobile", e.target.value)} placeholder="Mobile" className={inputCls} />
              <input value={c.phone ?? ""} onChange={(e) => updateContact(i, "phone", e.target.value)} placeholder="Office phone" className={inputCls} />
            </div>
          </div>
        ))}
        {contacts.length < MAX_CONTACTS && (
          <button type="button" onClick={addContact} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-3 py-1.5 hover:bg-gray-50 w-fit">
            + Add Contact
          </button>
        )}
        {contacts.length === 0 && <p className="text-xs text-gray-400">No contacts yet</p>}
      </PanelSection>

      {/* ── Billing Address ── */}
      <PanelSection id="billing" title="Billing Address" badge={<StatusBadge ok={billingComplete} />}>
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fax</label>
            <input name="billing_fax" value={billing.fax} onChange={(e) => setBilling((p) => ({ ...p, fax: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">VAT Number</label>
          <input name="billing_vat" value={billing.vat} onChange={(e) => setBilling((p) => ({ ...p, vat: e.target.value }))} className={inputCls} />
        </div>
      </PanelSection>

      {/* ── Shipping Address ── */}
      <PanelSection id="shipping" title="Shipping Address" badge={<StatusBadge ok={shippingComplete} />}>
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
              <input name="shipping_name" value={shipping.name} onChange={(e) => setShipping((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
              <input name="shipping_address" value={shipping.address} onChange={(e) => setShipping((p) => ({ ...p, address: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input name="shipping_city" value={shipping.city} onChange={(e) => setShipping((p) => ({ ...p, city: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State / Region</label>
                <input name="shipping_state" value={shipping.state} onChange={(e) => setShipping((p) => ({ ...p, state: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Postcode</label>
                <input name="shipping_postcode" value={shipping.postcode} onChange={(e) => setShipping((p) => ({ ...p, postcode: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
                <CountrySelect
                  name="shipping_country"
                  value={shipping.country}
                  onChange={(v) => setShipping((p) => ({ ...p, country: v }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tel</label>
                <input name="shipping_tel" value={shipping.tel} onChange={(e) => setShipping((p) => ({ ...p, tel: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input name="shipping_email" type="email" value={shipping.email} onChange={(e) => setShipping((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fax</label>
                <input name="shipping_fax" value={shipping.fax} onChange={(e) => setShipping((p) => ({ ...p, fax: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">VAT Number</label>
              <input name="shipping_vat" value={shipping.vat} onChange={(e) => setShipping((p) => ({ ...p, vat: e.target.value }))} className={inputCls} />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shipping Memo</label>
          <textarea name="shipping_memo" defaultValue={initialData.shipping_memo ?? ""} rows={2} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shipping Terms</label>
          <textarea name="shipping_terms" value={shippingTerms} onChange={(e) => setShippingTerms(e.target.value)} rows={2} className={inputCls} placeholder="e.g. PORT OF SHIPMENT: TOKYO, JAPAN" />
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
      </PanelSection>

      {/* ── Other Info (Online Presence + Shops) ── */}
      <PanelSection id="other" title="Other Info">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Online Presence</p>
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

        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-3">Shops ({shops.length}/{MAX_SHOPS})</p>
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
      </PanelSection>

      {/* ── Contracts (files) ── */}
      {contractsSlot && (
        <PanelSection id="contracts" title="Contracts">
          {contractsSlot}
        </PanelSection>
      )}

        </div>{/* panel container */}
        </SectionCtx.Provider>
      </div>{/* side-menu layout */}

      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        {id ? (
          <span className="text-xs text-gray-400">
            {pending ? "Saving…" : result === "ok" ? "✓ Saved" : "Changes auto-save"}
          </span>
        ) : (
          <>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
              {pending ? "Saving..." : "Create"}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
