"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_COLOURS } from "@/lib/customer-constants";
import { deleteCustomers, bulkUpdateCustomerStatus, updateCustomer, getCustomerFull, getCustomerOrders, getCustomerPayments, getCustomerUsers } from "@/app/actions/customers";
import { buildCustomerInitialData } from "@/lib/customer-initial-data";
import { CustomerForm } from "@/components/customer-form";
import { ClientUserForm } from "@/components/client-user-form";
import { PortalUserRow } from "@/components/portal-user-row";
import { STATUS_LABELS, INVOICE_TYPE_LABELS } from "@/lib/order-constants";

type Customer = {
  id: string;
  legacy_id: string | null;
  name: string;
  customer_type: string;
  currency: string | null;
  billing_country: string | null;
  contract_status: string | null;
  tax_included: boolean;
  bank: string | null;
  registered_complete: boolean;
  order_count: number;
  unpaid_count: number;
};

const CURRENCY_COLOURS: Record<string, string> = {
  EUR: "bg-violet-50 text-violet-700",
  JPY: "bg-teal-50 text-teal-700",
  GBP: "bg-blue-50 text-blue-700",
};

const CONTRACT_STATUSES = ["Active", "Archived"] as const;

type SortKey = "legacy_id" | "name" | "customer_type" | "billing_country" | "currency";

function Pill({ text, cls }: { text: string; cls: string }) {
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-md font-medium ${cls}`}>{text}</span>;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// Registration-status icon (same style as Materials): green check / amber warning.
function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <span title={ok ? "Registration complete" : "Registration incomplete"} className="inline-flex">
      {ok ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-green-600">
          <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
        </svg>
      )}
    </span>
  );
}

// Tax presence icon: rose receipt when tax-included, faint when not.
function TaxIcon({ on }: { on: boolean }) {
  return (
    <span title={on ? "Tax included" : "No tax"} className={`inline-flex ${on ? "text-rose-600" : "text-gray-300"}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M4.5 3.75h15A1.5 1.5 0 0121 5.25v15.75l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5.25A1.5 1.5 0 014.5 3.75z" />
        <path d="M9 8.25l6 7.5M9.75 9h.01M14.25 15h.01" />
      </svg>
    </span>
  );
}

// Users (portal accounts) icon.
function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M15 9a3 3 0 11-6 0 3 3 0 016 0zM4.5 19.5a7.5 7.5 0 0115 0" />
    </svg>
  );
}

// Row action icons.
function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4.5 3.75h15A1.5 1.5 0 0121 5.25v15.75l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5.25A1.5 1.5 0 014.5 3.75z" />
      <path d="M7.5 8.25h9M7.5 11.25h9M7.5 14.25h5" />
    </svg>
  );
}
function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="2.25" y="5.25" width="19.5" height="13.5" rx="2" />
      <path d="M2.25 9.75h19.5M6 14.25h3" />
    </svg>
  );
}

export function CustomersClient({ customers, bankLabels = {}, canManageUsers = false }: { customers: Customer[]; bankLabels?: Record<string, string>; canManageUsers?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [fGroup, setFGroup] = useState("B2B"); // default: B2B
  const [fStatus, setFStatus] = useState("unarchived"); // hide Archived by default
  const [fCountry, setFCountry] = useState(""); // "" = all countries
  const [fReg, setFReg] = useState(""); // registration status: "" = all, "complete", "incomplete"
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [deleting, startDelete] = useTransition();
  const [savingStatus, startStatus] = useTransition();

  // Popups: edit (full form), orders, payments. Each loads its data on open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editData, setEditData] = useState<{ id: string; customer: any; bankOptions: any[] } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ordersModal, setOrdersModal] = useState<{ name: string; rows: any[] } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [paymentsModal, setPaymentsModal] = useState<{ name: string; entries: any[]; totalDebit: number; totalCredit: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [usersModal, setUsersModal] = useState<{ id: string; name: string; users: any[] } | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // id being loaded

  const openUsers = async (c: Customer) => {
    setLoading(c.id);
    const users = await getCustomerUsers(c.id);
    setLoading(null);
    setUsersModal({ id: c.id, name: c.name, users });
  };

  const openEdit = async (c: Customer) => {
    setLoading(c.id);
    const res = await getCustomerFull(c.id);
    setLoading(null);
    if (res) setEditData({ id: c.id, customer: res.customer, bankOptions: res.bankOptions });
  };
  const openOrders = async (c: Customer) => {
    setLoading(c.id);
    const rows = await getCustomerOrders(c.id);
    setLoading(null);
    setOrdersModal({ name: c.name, rows });
  };
  const openPayments = async (c: Customer) => {
    setLoading(c.id);
    const p = await getCustomerPayments(c.id);
    setLoading(null);
    setPaymentsModal({ name: c.name, ...p });
  };

  const statusOf = (c: Customer) => c.contract_status ?? "Active";

  // Distinct billing countries for the country filter dropdown.
  const countryOptions = useMemo(
    () => [...new Set(customers.map((c) => c.billing_country).filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) => a.localeCompare(b)),
    [customers]
  );

  // Search + status + country filter (but not the Type filter — so Type buttons show live counts).
  const preGroup = useMemo(() => {
    let list = customers;
    if (fStatus === "unarchived") list = list.filter((c) => statusOf(c) !== "Archived");
    else if (fStatus !== "all") list = list.filter((c) => statusOf(c) === fStatus);
    if (fCountry) list = list.filter((c) => c.billing_country === fCountry);
    if (fReg === "complete") list = list.filter((c) => c.registered_complete);
    else if (fReg === "incomplete") list = list.filter((c) => !c.registered_complete);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.legacy_id ?? "").includes(q));
    }
    return list;
  }, [customers, search, fStatus, fCountry, fReg]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of preGroup) m[c.customer_type] = (m[c.customer_type] ?? 0) + 1;
    return m;
  }, [preGroup]);

  const filtered = useMemo(() => {
    const list = fGroup ? preGroup.filter((c) => c.customer_type === fGroup) : preGroup;
    const { key, dir } = sort;
    return [...list].sort((a, b) => {
      const av = String(a[key] ?? "").toLowerCase();
      const bv = String(b[key] ?? "").toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [preGroup, fGroup, sort]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(() => (allSelected ? new Set() : new Set(filtered.map((c) => c.id))));

  const setSortKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const onDelete = () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} customer(s)? This can't be undone.`)) return;
    startDelete(async () => {
      const err = await deleteCustomers(ids);
      if (err) alert(err);
      else { setSelected(new Set()); router.refresh(); }
    });
  };

  const onSetStatus = (status: string) => {
    const ids = [...selected];
    if (!ids.length || !status) return;
    startStatus(async () => {
      const err = await bulkUpdateCustomerStatus(ids, status);
      if (err) alert(err);
      else { setSelected(new Set()); router.refresh(); }
    });
  };

  const seg = (active: boolean) =>
    `px-3 py-1 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;

  const th = "text-left px-3 py-2 text-xs font-medium text-gray-500 select-none";
  const sortableTh = th + " cursor-pointer hover:text-gray-700";
  const td = "px-3 py-2.5";
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");
  const rowBtn = "inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          <button type="button" onClick={() => setFGroup("")} className={seg(fGroup === "")}>
            All <span className="opacity-50">{preGroup.length}</span>
          </button>
          {CUSTOMER_TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setFGroup(t)} className={seg(fGroup === t)}>
              {CUSTOMER_TYPE_LABELS[t]} <span className="opacity-50">{typeCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          aria-label="Filter by status"
        >
          <option value="unarchived">Active</option>
          <option value="Archived">Archived</option>
          <option value="all">All statuses</option>
        </select>

        <select
          value={fReg}
          onChange={(e) => setFReg(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          aria-label="Filter by registration status"
        >
          <option value="">All registration</option>
          <option value="complete">Registration complete</option>
          <option value="incomplete">Registration incomplete</option>
        </select>

        <select
          value={fCountry}
          onChange={(e) => setFCountry(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          aria-label="Filter by country"
        >
          <option value="">All countries</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="ml-auto relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="align-middle accent-gray-900" />
              </th>
              <th className={th + " text-center w-10"}></th>
              <th className={sortableTh + " w-24"} onClick={() => setSortKey("customer_type")}>Type / ID{arrow("customer_type")}</th>
              <th className={sortableTh + " min-w-52"} onClick={() => setSortKey("name")}>Name{arrow("name")}</th>
              <th className={sortableTh} onClick={() => setSortKey("billing_country")}>Country{arrow("billing_country")}</th>
              <th className={sortableTh} onClick={() => setSortKey("currency")}>Currency{arrow("currency")}</th>
              <th className={th + " text-center"}>Tax</th>
              <th className={th}>Bank</th>
              <th className={th + " text-right"}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const isSel = selected.has(c.id);
              const archived = statusOf(c) === "Archived";
              return (
                <tr
                  key={c.id}
                  onClick={() => openEdit(c)}
                  className={`cursor-pointer transition-colors ${isSel ? "bg-gray-50" : "hover:bg-gray-50/70"} ${archived ? "opacity-50" : ""} ${loading === c.id ? "animate-pulse" : ""}`}
                >
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} className="align-middle accent-gray-900" />
                  </td>
                  <td className={td + " text-center"}><StatusIcon ok={c.registered_complete} /></td>
                  <td className={td}>
                    <Pill text={CUSTOMER_TYPE_LABELS[c.customer_type] ?? c.customer_type} cls={CUSTOMER_TYPE_COLOURS[c.customer_type] ?? "bg-gray-100 text-gray-600"} />
                    <div className="font-mono text-[11px] text-gray-400 mt-0.5">{c.legacy_id ?? "—"}</div>
                  </td>
                  <td className={td + " font-medium text-gray-900"}>
                    {c.name}
                    {archived && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">Archived</span>}
                  </td>
                  <td className={td + " text-gray-600 text-xs"}>{c.billing_country ?? "—"}</td>
                  <td className={td}>
                    <Pill text={c.currency ?? "—"} cls={CURRENCY_COLOURS[c.currency ?? ""] ?? "bg-gray-100 text-gray-500"} />
                  </td>
                  <td className={td + " text-center"}><TaxIcon on={c.tax_included} /></td>
                  <td className={td + " text-gray-600 text-xs"}>{c.bank ? (bankLabels[c.bank] ?? c.bank) : "—"}</td>
                  <td className={td + " text-right"} onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <button type="button" onClick={() => openOrders(c)} className={rowBtn} title={`${c.order_count} order(s)`} aria-label="Orders">
                        <OrdersIcon />
                        {c.order_count > 0 && <span className="ml-0.5 text-[10px] text-gray-600">{c.order_count}</span>}
                      </button>
                      <button type="button" onClick={() => openPayments(c)} className={rowBtn} title={c.unpaid_count > 0 ? `${c.unpaid_count} unpaid invoice(s)` : "Payments"} aria-label="Payments">
                        <PaymentIcon />
                        {c.unpaid_count > 0 && <span className="ml-0.5 text-[10px] font-semibold text-red-600">{c.unpaid_count}</span>}
                      </button>
                      <button type="button" onClick={() => openUsers(c)} className={rowBtn} title="Portal users" aria-label="Users">
                        <UsersIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-gray-400 text-sm">
                  {search || fGroup || fCountry || fReg || fStatus !== "unarchived" ? "No customers match the filters" : "No customers yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">{filtered.length} of {customers.length} customers</p>

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-900 text-white rounded-xl shadow-lg px-2 py-1.5 text-sm">
          <span className="px-3 py-1 text-gray-300">{selected.size} selected</span>
          <span className="w-px h-5 bg-white/15" />
          {CONTRACT_STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => onSetStatus(s)} disabled={savingStatus}
              className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">{s}</button>
          ))}
          <span className="w-px h-5 bg-white/15" />
          <button type="button" onClick={onDelete} disabled={deleting}
            className="px-3 py-1 rounded-lg text-red-300 hover:bg-white/10 disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <span className="w-px h-5 bg-white/15" />
          <button type="button" onClick={() => setSelected(new Set())} className="px-2 py-1 rounded-lg text-gray-400 hover:bg-white/10" aria-label="Clear selection">✕</button>
        </div>
      )}

      {/* Edit popup — full customer form (auto-saves) */}
      {editData && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setEditData(null); router.refresh(); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-sm font-semibold text-gray-900">Edit customer · {editData.customer.name}</h2>
              <button type="button" onClick={() => { setEditData(null); router.refresh(); }} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            <div className="p-5">
              <CustomerForm action={updateCustomer} id={editData.id} bankOptions={editData.bankOptions} initialData={buildCustomerInitialData(editData.customer)} />
            </div>
          </div>
        </div>
      )}

      {/* Orders popup */}
      {ordersModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOrdersModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Orders · {ordersModal.name} <span className="text-gray-400 font-normal">({ordersModal.rows.length})</span></h2>
              <button type="button" onClick={() => setOrdersModal(null)} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            {ordersModal.rows.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400">No orders yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Season</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Invoice</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordersModal.rows.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-700">{o.order_date ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{o.seasons?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{STATUS_LABELS[o.status] ?? o.status ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{INVOICE_TYPE_LABELS[o.invoice_type] ?? o.invoice_type ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{o.currency_type ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payments popup */}
      {paymentsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPaymentsModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Payments · {paymentsModal.name}</h2>
              <button type="button" onClick={() => setPaymentsModal(null)} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            <div className="px-5 py-2 flex gap-6 text-xs border-b border-gray-100">
              <span className="text-gray-500">Billed (debit): <b className="text-gray-800">¥{paymentsModal.totalDebit.toLocaleString()}</b></span>
              <span className="text-gray-500">Paid (credit): <b className="text-gray-800">¥{paymentsModal.totalCredit.toLocaleString()}</b></span>
              <span className="text-gray-500">Balance: <b className="text-gray-800">¥{(paymentsModal.totalDebit - paymentsModal.totalCredit).toLocaleString()}</b></span>
            </div>
            {paymentsModal.entries.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400">No payment entries yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Date</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Type</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-600">Amount</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-600">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentsModal.entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-700">{e.entry_date ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 capitalize">{e.type}</td>
                      <td className="px-4 py-2 text-xs text-right font-mono text-gray-700">{(e.currency === "EUR" ? "€" : "¥")}{Number(e.amount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{e.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Users popup — portal accounts for this customer */}
      {usersModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setUsersModal(null); router.refresh(); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Portal users · {usersModal.name}</h2>
              <button type="button" onClick={() => { setUsersModal(null); router.refresh(); }} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            <div className="p-5 space-y-4">
              {usersModal.users.length === 0 ? (
                <p className="text-xs text-gray-400">No portal users yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {usersModal.users.map((u) => (
                    <PortalUserRow key={u.id} userId={u.id} customerId={usersModal.id} email={u.email ?? ""} displayName={u.displayName} canManage={canManageUsers} />
                  ))}
                </ul>
              )}
              {canManageUsers ? (
                <div className="border-t border-gray-100 pt-3">
                  <h3 className="text-sm font-medium text-gray-800 mb-2">Add portal user</h3>
                  <ClientUserForm customerId={usersModal.id} />
                </div>
              ) : (
                <p className="text-xs text-gray-400">Only Brand users can manage portal users.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
