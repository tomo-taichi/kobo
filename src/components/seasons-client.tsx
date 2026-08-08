"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkArchiveSeasons, bulkDeleteSeasons, updateSeasonFields } from "@/app/actions/seasons";
import { BulkBar } from "@/components/bulk-bar";

type Stat = {
  b2b_eur: number; b2c_eur: number; b2b_jpy: number; b2c_jpy: number;
  order_customers: number; billed_eur: number; paid_eur: number; unpaid_customers: number;
  products_by_category: Record<string, number>; total_units: number;
};
type Season = { id: string; name: string; eur_jpy_rate: number | null; archived: boolean; stat: Stat | null };

const eur = (v: number) => `€${Math.round(v).toLocaleString("en-US")}`;
const jpy = (v: number) => `¥${Math.round(v).toLocaleString("en-US")}`;

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function Stat3({ label, main, sub }: { label: string; main: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{main}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

const CAT_ORDER = ["Coat", "Jacket", "Trousers", "Knitwear", "Shirt", "T-shirt", "Accessories", "Watch", "Eyewear", "Shoes", "Bag", "Other"];

function SeasonCard({ s, selected, onToggle, onEdit }: { s: Season; selected: boolean; onToggle: () => void; onEdit: () => void }) {
  const st = s.stat;
  const billed = st?.billed_eur ?? 0;
  const paid = st?.paid_eur ?? 0;
  const pct = billed > 0 ? Math.min(100, Math.round((paid / billed) * 100)) : 0;
  const cats = Object.entries(st?.products_by_category ?? {}).sort(
    (a, b) => (CAT_ORDER.indexOf(a[0]) === -1 ? 99 : CAT_ORDER.indexOf(a[0])) - (CAT_ORDER.indexOf(b[0]) === -1 ? 99 : CAT_ORDER.indexOf(b[0]))
  );
  const maxUnits = Math.max(1, ...cats.map(([, n]) => n));

  return (
    <div className={`border rounded-xl bg-white p-4 transition-colors ${selected ? "border-gray-900 ring-1 ring-gray-900/10" : "border-gray-200"} ${s.archived ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${s.name}`} className="accent-gray-900" />
        <Link href={`/seasons/${s.id}`} className="text-base font-semibold text-gray-900 hover:underline">{s.name}</Link>
        {s.archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>}
        <span className="ml-auto text-xs text-gray-400">{s.eur_jpy_rate != null ? `¥${Number(s.eur_jpy_rate)}/€` : "—"}</span>
        <button type="button" onClick={onEdit} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
          <EditIcon />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Sales */}
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sales</div>
          <Stat3 label="B2B" main={eur(st?.b2b_eur ?? 0)} sub={jpy(st?.b2b_jpy ?? 0)} />
          <Stat3 label="B2C" main={eur(st?.b2c_eur ?? 0)} sub={jpy(st?.b2c_jpy ?? 0)} />
          <Stat3 label="Customers" main={String(st?.order_customers ?? 0)} />
        </div>

        {/* Payment */}
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Payment</div>
          <Stat3 label="Paid" main={eur(paid)} sub={`of ${eur(billed)} billed`} />
          <div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1"><span>Collected</span><span>{pct}%</span></div>
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Stat3 label="Invoiced · unpaid" main={String(st?.unpaid_customers ?? 0)} sub="customers" />
        </div>

        {/* Production */}
        <div className="rounded-lg bg-gray-50 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Production</div>
          <Stat3 label="Ordered units" main={String(st?.total_units ?? 0)} />
          {cats.length === 0 ? (
            <p className="text-[11px] text-gray-400">No orders yet</p>
          ) : (
            <div className="space-y-1">
              {cats.map(([cat, n]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-[10px] text-gray-500 truncate" title={cat}>{cat}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-indigo-400" style={{ width: `${(n / maxUnits) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right text-[10px] text-gray-600 tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditModal({ season, onClose, onSaved }: { season: Season; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(season.name);
  const [rate, setRate] = useState(season.eur_jpy_rate != null ? String(season.eur_jpy_rate) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const save = () => startSave(async () => {
    const err = await updateSeasonFields(season.id, name, Number(rate));
    if (err) setError(err);
    else onSaved();
  });

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Edit season</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Season Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. 26.2" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Exchange Rate (JPY/EUR) <span className="text-red-500">*</span></label>
            <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.01" min="0" className={inputCls} placeholder="e.g. 130" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !name.trim() || !(Number(rate) > 0)} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SeasonsClient({ seasons }: { seasons: Season[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [pending, startBulk] = useTransition();

  const archivedCount = seasons.filter((s) => s.archived).length;
  const shown = useMemo(() => (showArchived ? seasons : seasons.filter((s) => !s.archived)), [seasons, showArchived]);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const runBulk = (fn: () => Promise<string | null>) => startBulk(async () => {
    const err = await fn(); if (err) alert(err); else { setSelected(new Set()); router.refresh(); }
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input type="checkbox" className="accent-gray-900"
            checked={shown.length > 0 && shown.every((s) => selected.has(s.id))}
            onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((s) => s.id)) : new Set())} />
          Select all
        </label>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline">
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {shown.map((s) => (
          <SeasonCard key={s.id} s={s} selected={selected.has(s.id)} onToggle={() => toggle(s.id)} onEdit={() => setEditing(s)} />
        ))}
      </div>
      {!shown.length && <p className="text-center text-gray-400 text-sm py-10">No seasons</p>}

      <BulkBar
        count={selected.size}
        pending={pending}
        onArchive={() => runBulk(() => bulkArchiveSeasons([...selected], true))}
        onUnarchive={() => runBulk(() => bulkArchiveSeasons([...selected], false))}
        onDelete={() => { if (confirm(`Delete ${selected.size} season(s)? This can't be undone.`)) runBulk(() => bulkDeleteSeasons([...selected])); }}
        onClear={() => setSelected(new Set())}
      />

      {editing && (
        <EditModal season={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
      )}
    </div>
  );
}
