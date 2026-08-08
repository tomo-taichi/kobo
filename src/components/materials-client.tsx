"use client";

import { Fragment, useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MATERIAL_CATEGORIES,
  CATEGORY_LABELS,
  COMPOSITION_GROUPS,
  isFabric,
  getMaterialStatus,
} from "@/lib/material-constants";
import { duplicateMaterial, deleteMaterial, updateMaterialUniformSetPrice, bulkArchiveMaterials, bulkDeleteMaterials, autosaveMaterial } from "@/app/actions/materials";
import { BulkBar } from "@/components/bulk-bar";
import { MaterialForm } from "@/components/material-form";

type LabeledValue = { value: string; label: string };
type MaterialOptions = { fabricCategories: LabeledValue[]; accessoryCategories: LabeledValue[]; units: LabeledValue[]; compositions: string[] };

type CompEntry = { label: string | null; pct: number | null };
type ColorEntry = { color: string; unitPrice: number | null; setPrice: number | null };

type Material = {
  id: string;
  material_number: string | null;
  archived: boolean;
  price_uniform: boolean;
  main_product_count: number;
  name: string;
  category: string;
  unit_price_jpy: number;
  set_price_jpy: number;
  unit_type: string;
  color: string | null;
  supplier_id: string | null;
  supplier_item_code: string | null;
  season_id: string | null;
  suppliers: { name: string } | null;
  seasons: { name: string } | null;
  comps: CompEntry[];
  colors: ColorEntry[];
};

type Supplier = { id: string; name: string };
type Season   = { id: string; name: string };
type SortKey  = "material_number" | "name" | "category" | "unit_price";
type GroupMode = "none" | "category" | "season";

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: "none",     label: "Flat" },
  { value: "category", label: "Category" },
  { value: "season",   label: "Season" },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M9.5 3H5a2 2 0 00-2 2v4.5a2 2 0 00.6 1.4l8.5 8.5a2 2 0 002.8 0l4.5-4.5a2 2 0 000-2.8L10.9 3.6A2 2 0 009.5 3zM6.5 7h.01" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
    </svg>
  );
}

const firstUnitPrice = (m: Material) => m.colors[0]?.unitPrice ?? m.unit_price_jpy;
const firstSetPrice = (m: Material) => m.colors[0]?.setPrice ?? m.set_price_jpy;

const statusOf = (m: Material) => getMaterialStatus({
  set_price_jpy: m.set_price_jpy,
  comp_1_pct: m.comps[0]?.pct, comp_2_pct: m.comps[1]?.pct, comp_3_pct: m.comps[2]?.pct,
  comp_4_pct: m.comps[3]?.pct, comp_5_pct: m.comps[4]?.pct,
});

// Compact status indicator (saves width vs a text pill).
function StatusIcon({ status }: { status: string }) {
  const complete = status === "Complete";
  return (
    <span title={status} className="inline-flex">
      {complete ? (
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

// Per-row delete with confirmation. Trigger is an icon; stops row navigation.
function MaterialDeleteButton({ materialId, name, onDeleted }: { materialId: string; name: string; onDeleted: () => void }) {
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteMaterial(materialId);
    if (result) { setError(result); setPending(false); }
    else { onDeleted(); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Delete"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
        <TrashIcon />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">⚠</div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Delete material?</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  <span className="font-medium text-gray-700">{name}</span> and its colours will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={pending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Composition entries (≥1%) → ["カシミヤ 100%", ...] one per line.
function compLines(comps: CompEntry[]) {
  return comps.filter((c) => c.label && (c.pct ?? 0) >= 1).map((c) => `${c.label?.split("-")[0]} ${c.pct}%`);
}
function coloursLabel(m: Material): string {
  if (m.colors.length >= 2) return `${m.colors.length} colours`;
  if (m.colors.length === 1) return m.colors[0].color;
  return m.color ?? "—";
}

export function MaterialsClient({
  materials: initialMaterials,
  suppliers,
  seasons,
  pastColors = [],
  materialOptions,
  initialCategory,
  initialSeason,
  initialSupplier = "",
}: {
  materials: Material[];
  suppliers: Supplier[];
  seasons: Season[];
  pastColors?: string[];
  materialOptions?: MaterialOptions;
  initialCategory?: string;
  initialSeason?: string;
  initialSupplier?: string;
}) {
  const router = useRouter();
  const [materials, setMaterials] = useState(initialMaterials);
  const [editMat, setEditMat] = useState<Material | null>(null);

  const [search, setSearch]       = useState("");
  const [fCat, setFCat]           = useState(initialCategory ?? "woven"); // default: Woven
  const [fSeason, setFSeason]     = useState(initialSeason ?? (seasons[0]?.id ?? "")); // default: most recent season
  const [fSupplier, setFSupplier] = useState(initialSupplier);
  const [fComp, setFComp]         = useState("");
  const [fStatus, setFStatus]     = useState("");
  const [sort, setSort]           = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [bulkPending, startBulk]  = useTransition();

  const archivedCount = materials.filter((m) => m.archived).length;
  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const runBulk = (fn: () => Promise<string | null>) => startBulk(async () => {
    const err = await fn(); if (err) alert(err); else { setSelected(new Set()); router.refresh(); }
  });

  // Inline Set ¥ editing (double-click the cell)
  const [editId, setEditId]   = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving]   = useState(false);

  const setSortKey = useCallback((key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 })), []);

  const startEditSet = (m: Material) => { setEditId(m.id); setEditVal(String(firstSetPrice(m))); };
  const commitSet = async () => {
    if (!editId) return;
    const id = editId, v = Number(editVal) || 0;
    setSaving(true);
    await updateMaterialUniformSetPrice(id, v); // uniform pricing → all colours
    setMaterials((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      return { ...m, set_price_jpy: v, colors: m.colors.map((c) => ({ ...c, setPrice: v })) };
    }));
    setSaving(false);
    setEditId(null);
  };

  // Season filter order: "ALLSS" pinned first, then the rest as given (recency desc).
  const seasonOrder = useMemo(() => {
    const all = seasons.filter((s) => s.name === "ALLSS");
    const rest = seasons.filter((s) => s.name !== "ALLSS");
    return [...all, ...rest];
  }, [seasons]);

  // Everything except the category filter — so the category segments show live counts.
  const preCat = useMemo(() => {
    let list = showArchived ? materials : materials.filter((m) => !m.archived);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.material_number ?? "").includes(q) || m.colors.some((c) => c.color.toLowerCase().includes(q)));
    }
    if (fSeason)   list = list.filter((m) => m.season_id === fSeason);
    if (fSupplier) list = list.filter((m) => m.supplier_id === fSupplier);
    if (fComp)     list = list.filter((m) => m.comps.some((c) => c.label === fComp && (c.pct ?? 0) >= 1));
    if (fStatus)   list = list.filter((m) => statusOf(m) === fStatus);
    return list;
  }, [materials, showArchived, search, fSeason, fSupplier, fComp, fStatus]);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of preCat) m[x.category] = (m[x.category] ?? 0) + 1;
    return m;
  }, [preCat]);

  const filtered = useMemo(() => {
    const list = fCat ? preCat.filter((m) => m.category === fCat) : preCat;
    const { key, dir } = sort;
    const val = (m: Material): string | number =>
      key === "material_number" ? Number(m.material_number ?? 0)
      : key === "name" ? m.name.toLowerCase()
      : key === "category" ? m.category
      : firstUnitPrice(m);
    return [...list].sort((a, b) => {
      const av = val(a), bv = val(b);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [preCat, fCat, sort]);

  const grouped = useMemo(() => {
    if (groupMode === "none") return [] as [string, Material[]][];
    const map = new Map<string, Material[]>();
    for (const m of filtered) {
      const key = groupMode === "category" ? (CATEGORY_LABELS[m.category] ?? m.category) : (m.seasons?.name ?? "—");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupMode]);

  const hasFilter = search || fCat || fSeason || fSupplier || fComp || fStatus;

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");
  const th = "px-3 py-2 text-xs font-medium text-gray-500 select-none";
  const sTh = th + " cursor-pointer hover:text-gray-700";
  const td = "px-3 py-2.5";
  const segCls = (active: boolean) => `px-3 py-1 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;
  const selCls = "px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10";
  const rowBtn = "inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors";

  function renderRow(m: Material) {
    const status = statusOf(m);
    const lines = compLines(m.comps);
    const multi = m.colors.length >= 2;
    const editing = editId === m.id;
    const isSel = selected.has(m.id);
    return (
      <tr key={m.id} onClick={() => setEditMat(m)}
        className={`cursor-pointer transition-colors ${isSel ? "bg-gray-50" : "hover:bg-gray-50/70"} ${m.archived ? "opacity-50" : ""}`}>
        <td className={td} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSel} onChange={() => toggleSel(m.id)} aria-label={`Select ${m.name}`} className="align-middle accent-gray-900" />
        </td>
        <td className={`${td} text-center`}><StatusIcon status={status} /></td>
        <td className={`${td} font-mono text-gray-500 text-xs`}>
          {m.material_number ?? "—"}
          {m.archived && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 align-middle">A</span>}
        </td>

        {/* Season + Category (stacked, saves width) */}
        <td className={td}>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-md font-medium ${isFabric(m.category) ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
            {CATEGORY_LABELS[m.category] ?? m.category}
          </span>
          <div className="text-xs text-gray-400 mt-0.5">{m.seasons?.name ?? "—"}</div>
        </td>

        <td className={td}>
          {m.suppliers?.name && <div className="text-[10px] text-gray-400 leading-tight truncate max-w-[220px]" title={m.suppliers.name}>{m.suppliers.name}</div>}
          <div className="font-medium text-gray-900">{m.name}</div>
        </td>

        {/* Colours — summarised; hover shows the full list (native tooltip) */}
        <td
          className={`${td} text-xs ${multi ? "text-gray-500 underline decoration-dotted" : "text-gray-800"}`}
          title={multi ? m.colors.map((c) => c.color).join(", ") : undefined}
        >
          {coloursLabel(m)}
        </td>

        {/* Composition — one line per component */}
        <td className={`${td} text-gray-500 text-xs`}>
          {lines.length ? lines.map((l, i) => <div key={i} className="leading-tight">{l}</div>) : <span className="text-gray-300">—</span>}
        </td>

        <td className={`${td} text-right`}>{firstUnitPrice(m).toLocaleString("en-GB")}</td>

        {/* Set ¥ — editable only when pricing is uniform (one price for all colours);
            per-colour materials are read-only here (edit in the form). */}
        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()} onDoubleClick={() => { if (m.price_uniform) startEditSet(m); }}>
          {editing ? (
            <input
              autoFocus
              type="number" min="0" step="1"
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onBlur={commitSet}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditId(null); }}
              disabled={saving}
              className="w-24 px-2 py-1 border-2 border-gray-900 rounded text-sm text-right focus:outline-none bg-white"
            />
          ) : m.price_uniform ? (
            <span className="cursor-pointer hover:bg-yellow-50 rounded px-1 -mx-1" title="Double-click to edit (uniform price)">
              {firstSetPrice(m).toLocaleString("en-GB")}
            </span>
          ) : (
            <span className="text-gray-400" title="Per-colour pricing — edit in the material form">
              {multi ? "per colour" : firstSetPrice(m).toLocaleString("en-GB")}
            </span>
          )}
        </td>

        {/* Products using this as main material + link to the filtered products list */}
        <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
          {m.main_product_count > 0 ? (
            <a href={`/products?material=${m.id}`} target="_blank" rel="noopener" title={`${m.main_product_count} product(s) use this as main material`}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <TagIcon /> {m.main_product_count}
            </a>
          ) : (
            <span className="text-gray-300 text-xs">0</span>
          )}
        </td>

        {/* Actions — icons; stop row navigation */}
        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <form action={async () => { await duplicateMaterial(m.id); }}>
              <button type="submit" title="Duplicate" className={rowBtn}><CopyIcon /></button>
            </form>
            <MaterialDeleteButton materialId={m.id} name={m.name} onDeleted={() => setMaterials((prev) => prev.filter((x) => x.id !== m.id))} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg bg-gray-100 p-0.5 flex-wrap">
            <button type="button" onClick={() => setFCat("")} className={segCls(fCat === "")}>
              All <span className="opacity-50">{preCat.length}</span>
            </button>
            {MATERIAL_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setFCat(c)} className={segCls(fCat === c)}>
                {CATEGORY_LABELS[c]} <span className="opacity-50">{catCounts[c] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
            <input
              type="text"
              placeholder="Search name, ID or colour..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={fSeason} onChange={(e) => setFSeason(e.target.value)} className={selCls} aria-label="Season">
            <option value="">All Seasons</option>
            {seasonOrder.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} className={selCls} aria-label="Supplier">
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fComp} onChange={(e) => setFComp(e.target.value)} className={selCls} aria-label="Composition">
            <option value="">All Compositions</option>
            {COMPOSITION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item} value={item}>{item.split("-")[0]}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls} aria-label="Status">
            <option value="">All Status</option>
            <option value="Complete">Complete</option>
            <option value="Incomplete">Incomplete</option>
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-400">Group</span>
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              {GROUP_OPTIONS.map((g) => (
                <button key={g.value} type="button" onClick={() => setGroupMode(g.value)} className={segCls(groupMode === g.value)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          {archivedCount > 0 && (
            <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-gray-500 hover:text-gray-900 underline">
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </button>
          )}
          {hasFilter && (
            <button onClick={() => { setSearch(""); setFCat(""); setFSeason(""); setFSupplier(""); setFComp(""); setFStatus(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" aria-label="Select all"
                  checked={filtered.length > 0 && filtered.every((m) => selected.has(m.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((m) => m.id)) : new Set())}
                  className="align-middle accent-gray-900" />
              </th>
              <th className={th + " text-center w-10"}></th>
              <th className={sTh + " text-left w-16"} onClick={() => setSortKey("material_number")}>ID{arrow("material_number")}</th>
              <th className={sTh + " text-left"} onClick={() => setSortKey("category")}>Season / Category{arrow("category")}</th>
              <th className={sTh + " text-left min-w-56"} onClick={() => setSortKey("name")}>Name{arrow("name")}</th>
              <th className={th + " text-left"}>Colours</th>
              <th className={th + " text-left"}>Composition</th>
              <th className={sTh + " text-right whitespace-nowrap"} onClick={() => setSortKey("unit_price")}>Unit ¥{arrow("unit_price")}</th>
              <th className={th + " text-right whitespace-nowrap"}>Set ¥</th>
              <th className={th + " text-center w-16"}>Used in</th>
              <th className={th + " w-16"}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groupMode === "none"
              ? filtered.map(renderRow)
              : grouped.map(([key, rows]) => (
                  <Fragment key={key}>
                    <tr className="bg-gray-50/80 border-t border-b border-gray-200">
                      <td colSpan={11} className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {key} <span className="text-gray-400 font-normal">({rows.length})</span>
                      </td>
                    </tr>
                    {rows.map(renderRow)}
                  </Fragment>
                ))}
            {!filtered.length && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {hasFilter ? "No materials match the filters" : "No materials yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">{filtered.length} of {materials.length} materials — click a row to edit</p>

      <BulkBar
        count={selected.size}
        pending={bulkPending}
        onArchive={() => runBulk(() => bulkArchiveMaterials([...selected], true))}
        onUnarchive={() => runBulk(() => bulkArchiveMaterials([...selected], false))}
        onDelete={() => { if (confirm(`Delete ${selected.size} material(s)? This can't be undone.`)) runBulk(() => bulkDeleteMaterials([...selected])); }}
        onClear={() => setSelected(new Set())}
      />

      {/* Edit modal (auto-saves) */}
      {editMat && materialOptions && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setEditMat(null); router.refresh(); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
              <h2 className="text-sm font-semibold text-gray-900">Edit material · <span className="font-mono text-gray-500">{editMat.material_number ?? "—"}</span></h2>
              <button type="button" onClick={() => { setEditMat(null); router.refresh(); }} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
            </div>
            <div className="p-5">
              <MaterialForm
                action={autosaveMaterial}
                autoSave
                suppliers={suppliers}
                seasons={seasons}
                pastColors={pastColors}
                fabricCategoryOptions={materialOptions.fabricCategories}
                accessoryCategoryOptions={materialOptions.accessoryCategories}
                unitOptions={materialOptions.units}
                compositionOptions={materialOptions.compositions}
                id={editMat.id}
                initialData={{
                  name: editMat.name,
                  category: editMat.category,
                  unit_price_jpy: editMat.unit_price_jpy,
                  set_price_jpy: editMat.set_price_jpy,
                  unit_type: editMat.unit_type,
                  supplier_id: editMat.supplier_id,
                  supplier_item_code: editMat.supplier_item_code ?? "",
                  season_id: editMat.season_id,
                  color: editMat.color ?? "",
                  price_uniform: editMat.price_uniform,
                  colors: editMat.colors.map((c) => ({ color: c.color, unit_price_jpy: c.unitPrice, set_price_jpy: c.setPrice })),
                  comp_1_label: editMat.comps[0]?.label ?? "", comp_1_pct: editMat.comps[0]?.pct ?? null,
                  comp_2_label: editMat.comps[1]?.label ?? "", comp_2_pct: editMat.comps[1]?.pct ?? null,
                  comp_3_label: editMat.comps[2]?.label ?? "", comp_3_pct: editMat.comps[2]?.pct ?? null,
                  comp_4_label: editMat.comps[3]?.label ?? "", comp_4_pct: editMat.comps[3]?.pct ?? null,
                  comp_5_label: editMat.comps[4]?.label ?? "", comp_5_pct: editMat.comps[4]?.pct ?? null,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
