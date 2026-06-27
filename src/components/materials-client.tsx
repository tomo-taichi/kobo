"use client";

import { Fragment, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MATERIAL_CATEGORIES,
  CATEGORY_LABELS,
  COMPOSITION_GROUPS,
  isFabric,
  getMaterialStatus,
} from "@/lib/material-constants";
import { updateMaterialField, updateMaterialFirstColorPrice, duplicateMaterial, deleteMaterial } from "@/app/actions/materials";

type CompEntry = { label: string | null; pct: number | null };
type ColorEntry = { color: string; unitPrice: number | null; setPrice: number | null };

type Material = {
  id: string;
  name: string;
  category: string;
  unit_price_jpy: number;
  set_price_jpy: number;
  unit_type: string;
  color: string | null;
  supplier_id: string | null;
  season_id: string | null;
  suppliers: { name: string } | null;
  seasons: { name: string } | null;
  comps: CompEntry[];
  colors: ColorEntry[];
};

type Supplier = { id: string; name: string };
type Season   = { id: string; name: string };
type SortKey  = "name_asc" | "name_desc" | "category_asc";
type GroupMode = "none" | "category" | "season";
type EditCell = { id: string; field: string } | null;

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: "none",     label: "Flat" },
  { value: "category", label: "Category" },
  { value: "season",   label: "Season" },
];

// Per-row delete with an always-on confirmation; removes the row from the list on success.
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
      <button type="button" onClick={() => setOpen(true)} className="text-gray-400 hover:text-red-600 text-xs underline">Delete</button>
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

function formatComps(comps: CompEntry[]) {
  return comps
    .filter((c) => c.label && (c.pct ?? 0) >= 1)
    .map((c) => `${c.label?.split("-")[0]} ${c.pct}%`)
    .join(" / ");
}

export function MaterialsClient({
  materials: initialMaterials,
  suppliers,
  seasons,
}: {
  materials: Material[];
  suppliers: Supplier[];
  seasons: Season[];
  pastColors?: string[];
}) {
  const [materials, setMaterials] = useState(initialMaterials);

  // filter/sort state
  const [search, setSearch]       = useState("");
  const [fCat, setFCat]           = useState("");
  const [fSeason, setFSeason]     = useState("");
  const [fSupplier, setFSupplier] = useState("");
  const [fComp, setFComp]         = useState("");
  const [sort, setSort]           = useState<SortKey>("name_asc");
  const [groupMode, setGroupMode] = useState<GroupMode>("none");

  // inline editing state (name / category / season only — colour & price are per-colour, edited in the form)
  const [editCell, setEditCell]   = useState<EditCell>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving]       = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const startEdit = useCallback((id: string, field: string, current: string) => {
    setEditCell({ id, field });
    setEditValue(current);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) { el.focus(); if ("select" in el) (el as HTMLInputElement).select(); }
    }, 0);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editCell) return;
    setSaving(true);
    const { id, field } = editCell;
    if (field === "unit_price_jpy" || field === "set_price_jpy") {
      const v = Number(editValue);
      await updateMaterialFirstColorPrice(id, field, v);
      const ck = field === "unit_price_jpy" ? "unitPrice" : "setPrice";
      setMaterials((prev) => prev.map((m) => {
        if (m.id !== id) return m;
        const colors = m.colors.length > 0 ? m.colors.map((c, i) => (i === 0 ? { ...c, [ck]: v } : c)) : m.colors;
        return { ...m, [field]: v, colors };
      }));
    } else {
      await updateMaterialField(id, field as any, editValue);
      setMaterials((prev) => prev.map((m) => {
        if (m.id !== id) return m;
        if (field === "name")      return { ...m, name: editValue };
        if (field === "category")  return { ...m, category: editValue };
        if (field === "season_id") return { ...m, season_id: editValue || null, seasons: seasons.find((s) => s.id === editValue) ?? null };
        return m;
      }));
    }
    setSaving(false);
    setEditCell(null);
  }, [editCell, editValue, seasons]);

  const cancelEdit = useCallback(() => setEditCell(null), []);

  const filtered = useMemo(() => {
    let list = materials;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.colors.some((c) => c.color.toLowerCase().includes(q)));
    }
    if (fCat)      list = list.filter((m) => m.category === fCat);
    if (fSeason)   list = list.filter((m) => m.season_id === fSeason);
    if (fSupplier) list = list.filter((m) => m.supplier_id === fSupplier);
    if (fComp)     list = list.filter((m) =>
      m.comps.some((c) => c.label === fComp && (c.pct ?? 0) >= 1)
    );
    const sorted = [...list];
    if (sort === "name_asc")          sorted.sort((a, b) => a.name.localeCompare(b.name, "en"));
    else if (sort === "name_desc")    sorted.sort((a, b) => b.name.localeCompare(a.name, "en"));
    else if (sort === "category_asc") sorted.sort((a, b) => a.category.localeCompare(b.category));
    return sorted;
  }, [materials, search, fCat, fSeason, fSupplier, fComp, sort]);

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

  const hasFilter = search || fCat || fSeason || fSupplier || fComp;

  const cellCls = "px-3 py-2.5 cursor-default select-none";
  const editableCls = `${cellCls} hover:bg-yellow-50 cursor-pointer`;
  const inputBaseCls = "w-full px-2 py-1 border-2 border-gray-900 rounded text-sm focus:outline-none bg-white";

  function isEditing(id: string, field: string) {
    return editCell?.id === id && editCell?.field === field;
  }

  function textCell(m: Material, field: "name", display: string | null) {
    const editing = isEditing(m.id, field);
    return editing ? (
      <td className="px-3 py-1.5">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") cancelEdit(); }}
          lang="en-GB"
          spellCheck
          disabled={saving}
          className={inputBaseCls}
        />
      </td>
    ) : (
      <td className={editableCls} onDoubleClick={() => startEdit(m.id, field, display ?? "")}>
        {display ?? <span className="text-gray-300">—</span>}
      </td>
    );
  }

  function selectCell(m: Material, field: "category" | "season_id", display: React.ReactNode, options: { value: string; label: string }[]) {
    const editing = isEditing(m.id, field);
    return editing ? (
      <td className="px-3 py-1.5">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => { setEditValue(e.target.value); setTimeout(commitEdit, 0); }}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
          disabled={saving}
          className={inputBaseCls + " bg-white"}
        >
          {field === "season_id" && <option value="">— None —</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
    ) : (
      <td className={editableCls} onDoubleClick={() => startEdit(m.id, field, field === "category" ? m.category : (m.season_id ?? ""))}>
        {display}
      </td>
    );
  }

  function numberCell(m: Material, field: "unit_price_jpy" | "set_price_jpy", value: number) {
    const editing = isEditing(m.id, field);
    return editing ? (
      <td className="px-3 py-1.5 text-right">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number" min="0" step="1"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") cancelEdit(); }}
          disabled={saving}
          className={inputBaseCls + " text-right w-28"}
        />
      </td>
    ) : (
      <td className={editableCls + " text-right"} onDoubleClick={() => startEdit(m.id, field, String(value))}>
        {value.toLocaleString("en-GB")}
      </td>
    );
  }

  function renderRow(m: Material) {
    const status = getMaterialStatus({
      set_price_jpy: m.set_price_jpy,
      comp_1_pct: m.comps[0]?.pct,
      comp_2_pct: m.comps[1]?.pct,
      comp_3_pct: m.comps[2]?.pct,
      comp_4_pct: m.comps[3]?.pct,
      comp_5_pct: m.comps[4]?.pct,
    });
    const categoryOptions = MATERIAL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));
    const seasonOptions = seasons.map((s) => ({ value: s.id, label: s.name }));
    const firstUnit = m.colors[0]?.unitPrice ?? m.unit_price_jpy;
    const firstSet  = m.colors[0]?.setPrice ?? m.set_price_jpy;

    return (
      <tr key={m.id} className="hover:bg-gray-50/50">
        {/* ID — not editable */}
        <td className={`${cellCls} font-mono text-gray-400 text-xs`}>{m.id.slice(0, 8)}</td>

        {/* Season — select */}
        {selectCell(m, "season_id",
          <span className="text-gray-500 text-xs">{m.seasons?.name ?? <span className="text-gray-300">—</span>}</span>,
          seasonOptions
        )}

        {/* Category — select */}
        {selectCell(m, "category",
          <span className={`text-xs px-2 py-0.5 rounded-full ${isFabric(m.category) ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
            {CATEGORY_LABELS[m.category] ?? m.category}
          </span>,
          categoryOptions
        )}

        {/* Name — text */}
        {textCell(m, "name", m.name)}

        {/* Colour — all colours (first bold, as its price is shown). Read-only; edit per colour in the form */}
        <td className={`${cellCls} text-xs`}>
          {m.colors.length > 0
            ? m.colors.map((c, i) => (
                <span key={i} className={i === 0 ? "text-gray-800 font-medium" : "text-gray-500"}>
                  {i > 0 ? ", " : ""}{c.color}
                </span>
              ))
            : (m.color ?? <span className="text-gray-300">—</span>)}
        </td>

        {/* Composition — not editable */}
        <td className={`${cellCls} text-gray-500 text-xs max-w-xs`}>
          {formatComps(m.comps) || <span className="text-gray-300">—</span>}
        </td>

        {/* Unit Price — first colour's (double-click to edit) */}
        {numberCell(m, "unit_price_jpy", firstUnit)}

        {/* Set Price — first colour's (double-click to edit) */}
        {numberCell(m, "set_price_jpy", firstSet)}

        {/* Status — derived, not editable */}
        <td className={`${cellCls} text-center`}>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status === "Complete" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
            {status}
          </span>
        </td>

        {/* Actions */}
        <td className={`${cellCls} text-right whitespace-nowrap`}>
          <div className="flex items-center justify-end gap-3">
            <form action={async () => { await duplicateMaterial(m.id); }}>
              <button type="submit" className="text-gray-400 hover:text-blue-600 text-xs underline">Duplicate</button>
            </form>
            <Link href={`/materials/${m.id}/edit`} className="text-gray-400 hover:text-gray-900 text-xs underline">Edit</Link>
            <MaterialDeleteButton materialId={m.id} name={m.name} onDeleted={() => setMaterials((prev) => prev.filter((x) => x.id !== m.id))} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Filter / sort bar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        <input
          type="text"
          placeholder="Search by name or colour..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            <option value="">All Categories</option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <select value={fSeason} onChange={(e) => setFSeason(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            <option value="">All Seasons</option>
            {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fComp} onChange={(e) => setFComp(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
            <option value="">All Compositions</option>
            {COMPOSITION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item} value={item}>{item.split("-")[0]}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-500">Group:</span>
            {GROUP_OPTIONS.map((g) => (
              <button key={g.value} type="button" onClick={() => setGroupMode(g.value)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  groupMode === g.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
                }`}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
              <option value="name_asc">Name A→Z</option>
              <option value="name_desc">Name Z→A</option>
              <option value="category_asc">Category</option>
            </select>
          </div>
          {hasFilter && (
            <button onClick={() => { setSearch(""); setFCat(""); setFSeason(""); setFSupplier(""); setFComp(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-3 font-medium text-gray-600 w-24">ID</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">Season</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">Category</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600 min-w-64">Name</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">Colours</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">Composition</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600">Unit Price (¥)</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600">Set Price (¥)</th>
            <th className="text-center px-3 py-3 font-medium text-gray-600">Status</th>
            <th className="px-3 py-3 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {groupMode === "none"
            ? filtered.map(renderRow)
            : grouped.map(([key, rows]) => (
                <Fragment key={key}>
                  <tr className="bg-gray-50/80 border-t border-b border-gray-200">
                    <td colSpan={10} className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {key} <span className="text-gray-400 font-normal">({rows.length})</span>
                    </td>
                  </tr>
                  {rows.map(renderRow)}
                </Fragment>
              ))}
          {!filtered.length && (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                {hasFilter ? "No materials match the filters" : "No materials yet"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
        {filtered.length} / {materials.length} items
        <span className="ml-3 text-gray-300">— prices are the first colour&apos;s; double-click Name / Season / Category / Unit / Set Price to edit, or open Edit for all colours</span>
      </div>
    </div>
  );
}
