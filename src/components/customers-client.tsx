"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_COLOURS } from "@/lib/customer-constants";
import { updateCustomerStatus } from "@/app/actions/customers";

type Customer = {
  id: string;
  name: string;
  customer_type: string;
  is_vip: boolean;
  deposit_terms: string;
  currency: string | null;
  tax_included: boolean;
  billing_country: string | null;
  contract_status: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
};

const CURRENCY_COLOURS: Record<string, string> = {
  EUR: "bg-violet-50 text-violet-700",
  JPY: "bg-teal-50 text-teal-700",
};

// Small colored status pill (shared by Type / Deposit / Currency / Tax cells).
function Pill({ text, cls }: { text: string; cls: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{text}</span>;
}

const CONTRACT_COLOURS: Record<string, string> = {
  Active:     "bg-green-50 text-green-700",
  "On Hold":  "bg-yellow-50 text-yellow-700",
  Terminated: "bg-red-50 text-red-600",
};

const CONTRACT_LABELS: Record<string, string> = {
  Active:     "Active",
  "On Hold":  "On Hold",
  Terminated: "Terminated",
};

const CONTRACT_STATUSES = [
  { value: "Active",     label: "Active" },
  { value: "On Hold",    label: "On Hold" },
  { value: "Terminated", label: "Terminated" },
] as const;

const SORT_OPTIONS = [
  { value: "name_asc",   label: "Name A→Z" },
  { value: "name_desc",  label: "Name Z→A" },
  { value: "group_asc",  label: "Type" },
] as const;

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [search, setSearch]           = useState("");
  const [fGroup, setFGroup]           = useState("");
  const [fStatus, setFStatus]         = useState("");
  const [showAll, setShowAll]         = useState(false);
  const [sort, setSort]               = useState<string>("name_asc");
  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [saving, startSave]           = useTransition();

  const filtered = useMemo(() => {
    let list = customers;
    if (!showAll) {
      list = list.filter((c) => (c.contract_status ?? "Active") !== "Terminated");
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (fGroup)  list = list.filter((c) => c.customer_type === fGroup);
    if (fStatus) list = list.filter((c) => (c.contract_status ?? "Active") === fStatus);
    list = [...list].sort((a, b) => {
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "group_asc") {
        const g = a.customer_type.localeCompare(b.customer_type);
        return g !== 0 ? g : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [customers, search, fGroup, fStatus, showAll, sort]);

  const terminatedCount = customers.filter((c) => (c.contract_status ?? "Active") === "Terminated").length;
  const hasFilter = search || fGroup || fStatus;

  function handleStatusChange(id: string, newStatus: string) {
    setEditStatusId(null);
    startSave(async () => {
      await updateCustomerStatus(id, newStatus);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={fGroup}
            onChange={(e) => setFGroup(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All Types</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>{CUSTOMER_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            <option value="">All Status</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilter && (
            <button
              onClick={() => { setSearch(""); setFGroup(""); setFStatus(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}

          {terminatedCount > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className={`ml-auto text-xs px-2 py-1.5 rounded border ${
                showAll
                  ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                  : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {showAll ? `Hide Terminated (${terminatedCount})` : `Show All (${terminatedCount} Terminated)`}
            </button>
          )}

          <span className={`text-xs text-gray-400 ${terminatedCount === 0 ? "ml-auto" : ""}`}>
            {filtered.length} / {showAll ? customers.length : customers.length - terminatedCount}
          </span>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-48">Name</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Deposit</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Currency</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Tax</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Country</th>
            <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((c) => {
            const status = c.contract_status ?? "Active";
            const isTerminated = status === "Terminated";
            const isEditingStatus = editStatusId === c.id;

            return (
              <tr key={c.id} className={`hover:bg-gray-50 ${isTerminated ? "opacity-60" : ""}`}>
                {/* Status — double-click to edit */}
                <td className="px-4 py-3">
                  {isEditingStatus ? (
                    <select
                      autoFocus
                      defaultValue={status}
                      disabled={saving}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      onBlur={() => setEditStatusId(null)}
                      className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                    >
                      {CONTRACT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      onDoubleClick={() => setEditStatusId(c.id)}
                      title="Double-click to change"
                      className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer select-none ${CONTRACT_COLOURS[status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {CONTRACT_LABELS[status] ?? status}
                    </span>
                  )}
                  {c.contract_end_date && isTerminated && !isEditingStatus && (
                    <div className="text-xs text-gray-400 mt-0.5">{c.contract_end_date}</div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CUSTOMER_TYPE_COLOURS[c.customer_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {CUSTOMER_TYPE_LABELS[c.customer_type] ?? c.customer_type}
                    </span>
                    {c.is_vip && <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">VIP</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  {c.deposit_terms === "Deposit_and_Production"
                    ? <Pill text="Deposit" cls="bg-emerald-50 text-emerald-700" />
                    : <Pill text="No Deposit" cls="bg-gray-100 text-gray-500" />}
                </td>
                <td className="px-4 py-3">
                  <Pill text={c.currency ?? "—"} cls={CURRENCY_COLOURS[c.currency ?? ""] ?? "bg-gray-100 text-gray-500"} />
                </td>
                <td className="px-4 py-3">
                  {c.tax_included
                    ? <Pill text="Tax" cls="bg-rose-50 text-rose-700" />
                    : <Pill text="No Tax" cls="bg-gray-100 text-gray-500" />}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.billing_country ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <Link href={`/customers/${c.id}/info`}     className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap">Info</Link>
                    <Link href={`/customers/${c.id}/orders`}   className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap">Orders</Link>
                    <Link href={`/customers/${c.id}/products`} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap">Products</Link>
                    <Link href={`/customers/${c.id}/payments`} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 whitespace-nowrap">Payments</Link>
                  </div>
                </td>
              </tr>
            );
          })}
          {!filtered.length && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                {hasFilter ? "No customers match the filters" : "No customers yet"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
