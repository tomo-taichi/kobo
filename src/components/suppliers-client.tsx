"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkArchiveSuppliers, bulkDeleteSuppliers, updateSupplier } from "@/app/actions/suppliers";
import { BulkBar } from "@/components/bulk-bar";
import { SupplierForm } from "@/components/supplier-form";

type Supplier = {
  id: string; name: string; country: string | null; address: string | null; company_phone: string | null;
  primary_name: string | null; primary_title: string | null; primary_mobile: string | null; primary_email: string | null;
  secondary_name: string | null; secondary_title: string | null; secondary_mobile: string | null; secondary_email: string | null;
  notes: string | null; archived: boolean; material_count: number;
};

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7L12 12l8.7-5M12 22V12" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function SuppliersClient({ suppliers, countryOptions }: { suppliers: Supplier[]; countryOptions: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pending, startBulk] = useTransition();

  const archivedCount = suppliers.filter((s) => s.archived).length;
  const shown = useMemo(() => {
    let list = showArchived ? suppliers : suppliers.filter((s) => !s.archived);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        [s.name, s.country, s.company_phone, s.primary_name, s.primary_email, s.primary_title]
          .some((v) => (v ?? "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [suppliers, showArchived, search]);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = shown.length > 0 && shown.every((s) => selected.has(s.id));
  const runBulk = (fn: () => Promise<string | null>) => startBulk(async () => {
    const err = await fn(); if (err) alert(err); else { setSelected(new Set()); router.refresh(); }
  });

  const td = "px-4 py-2.5";
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search name, country, tel or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
        <span className="text-xs text-gray-400">{shown.length} of {suppliers.length}</span>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSel}
                  onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((s) => s.id)) : new Set())}
                  className="align-middle accent-gray-900" />
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Supplier Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Country</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Company Tel</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Primary Contact</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Materials</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((s) => {
              const isSel = selected.has(s.id);
              return (
                <tr key={s.id} onClick={() => setEditing(s)}
                  className={`cursor-pointer hover:bg-gray-50 ${isSel ? "bg-gray-50" : ""} ${s.archived ? "opacity-50" : ""}`}>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} className="align-middle accent-gray-900" />
                  </td>
                  <td className={`${td} text-gray-900`}>
                    {s.name}
                    {s.archived && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">Archived</span>}
                  </td>
                  <td className={`${td} text-gray-500`}>{s.country ?? "—"}</td>
                  <td className={`${td} text-gray-500`}>{s.company_phone ?? "—"}</td>
                  <td className={`${td} text-gray-500`}>{s.primary_name ?? "—"}</td>
                  <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                    {s.material_count > 0 ? (
                      <a href={`/materials?supplier=${s.id}`} target="_blank" rel="noopener" title={`${s.material_count} material(s) from this supplier`}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                        <BoxIcon /> {s.material_count}
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">0</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">{search ? "No suppliers match" : "No suppliers"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <BulkBar
        count={selected.size}
        pending={pending}
        onArchive={() => runBulk(() => bulkArchiveSuppliers([...selected], true))}
        onUnarchive={() => runBulk(() => bulkArchiveSuppliers([...selected], false))}
        onDelete={() => { if (confirm(`Delete ${selected.size} supplier(s)? This can't be undone.`)) runBulk(() => bulkDeleteSuppliers([...selected])); }}
        onClear={() => setSelected(new Set())}
      />

      {/* Edit modal — updateSupplier redirects to /suppliers on success (closes modal + refresh) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-sm font-semibold text-gray-900">Edit supplier</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            <div className="p-5">
              <SupplierForm
                action={updateSupplier}
                id={editing.id}
                countryOptions={countryOptions}
                onCancel={() => setEditing(null)}
                initial={{
                  name: editing.name,
                  country: editing.country ?? "",
                  address: editing.address ?? "",
                  company_phone: editing.company_phone ?? "",
                  primary_name: editing.primary_name ?? "",
                  primary_title: editing.primary_title ?? "",
                  primary_mobile: editing.primary_mobile ?? "",
                  primary_email: editing.primary_email ?? "",
                  secondary_name: editing.secondary_name ?? "",
                  secondary_title: editing.secondary_title ?? "",
                  secondary_mobile: editing.secondary_mobile ?? "",
                  secondary_email: editing.secondary_email ?? "",
                  notes: editing.notes ?? "",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
