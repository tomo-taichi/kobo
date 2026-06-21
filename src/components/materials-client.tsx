"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MATERIAL_CATEGORIES,
  CATEGORY_LABELS,
  COMPOSITION_GROUPS,
  isFabric,
  getMaterialStatus,
} from "@/lib/material-constants";
import { updateMaterialField, duplicateMaterial } from "@/app/actions/materials";

type CompEntry = { label: string | null; pct: number | null };

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
};

type Supplier = { id: string; name: string };
type Season   = { id: string; name: string };
type SortKey  = "name_asc" | "name_desc" | "category_asc";
type EditCell = { id: string; field: string } | null;

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
  pastColors = [],
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

  // inline editing state
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
    await updateMaterialField(editCell.id, editCell.field as any, editValue);
    setMaterials((prev) => prev.map((m) => {
      if (m.id !== editCell.id) return m;
      const field = editCell.field;
      if (field === "name")           return { ...m, name: editValue };
      if (field === "color")          return { ...m, color: editValue || null };
      if (field === "category")       return { ...m, category: editValue };
      if (field === "season_id")      return { ...m, season_id: editValue || null, seasons: seasons.find((s) => s.id === editValue) ?? null };
      if (field === "unit_price_jpy") return { ...m, unit_price_jpy: Number(editValue) };
      if (field === "set_price_jpy")  return { ...m, set_price_jpy: Number(editValue) };
      return m;
    }));
    setSaving(false);
    setEditCell(null);
  }, [editCell, editValue, seasons]);

  const cancelEdit = useCallback(() => setEditCell(null), []);

  const filtered = useMemo(() => {
    let list = materials;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
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

  const hasFilter = search || fCat || fSeason || fSupplier || fComp;

  const cellCls = "px-3 py-2.5 cursor-default select-none";
  const editableCls = `${cellCls} hover:bg-yellow-50 cursor-pointer`;
  const inputBaseCls = "w-full px-2 py-1 border-2 border-gray-900 rounded text-sm focus:outline-none bg-white";

  function isEditing(id: string, field: string) {
    return editCell?.id === id && editCell?.field === field;
  }

  function textCell(m: Material, field: "name" | "color", display: string | null) {
    const editing = isEditing(m.id, field);
    return editing ? (
      <td className="px-3 py-1.5">
        {field === "color" && pastColors.length > 0 && (
          <datalist id={`dc-colours-${m.id}`}>
            {pastColors.map((c) => <option key={c} value={c} />)}
          </datalist>
        )}
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") cancelEdit(); }}
          list={field === "color" && pastColors.length > 0 ? `dc-colours-${m.id}` : undefined}
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

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Filter / sort bar */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2">
        <input
          type="text"
          placeholder="Search by name..."
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
            <th className="text-left px-3 py-3 font-medium text-gray-600">Colour</th>
            <th className="text-left px-3 py-3 font-medium text-gray-600">Composition</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600">Unit Price (¥)</th>
            <th className="text-right px-3 py-3 font-medium text-gray-600">Set Price (¥)</th>
            <th className="text-center px-3 py-3 font-medium text-gray-600">Status</th>
            <th className="px-3 py-3 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((m) => {
            const status = getMaterialStatus({
              set_price_jpy: m.set_price_jpy,
              comp_1_pct: m.comps[0]?.pct,
              comp_2_pct: m.comps[1]?.pct,
              comp_3_pct: m.comps[2]?.pct,
              comp_4_pct: m.comps[3]?.pct,
              comp_5_pct: m.comps[4]?.pct,
            });

            const categoryOptions = MATERIAL_CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORY_LABELS[c],
            }));
            const seasonOptions = seasons.map((s) => ({ value: s.id, label: s.name }));

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

                {/* Colour — text with datalist */}
                {textCell(m, "color", m.color)}

                {/* Composition — not editable */}
                <td className={`${cellCls} text-gray-500 text-xs max-w-xs`}>
                  {formatComps(m.comps) || <span className="text-gray-300">—</span>}
                </td>

                {/* Unit Price — number */}
                {numberCell(m, "unit_price_jpy", m.unit_price_jpy)}

                {/* Set Price — number */}
                {numberCell(m, "set_price_jpy", m.set_price_jpy)}

                {/* Status — derived, not editable */}
                <td className={`${cellCls} text-center`}>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status === "Complete" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {status}
                  </span>
                </td>

                {/* Actions */}
                <td className={`${cellCls} text-right whitespace-nowrap`}>
                  <div className="flex items-center justify-end gap-3">
                    <form action={duplicateMaterial.bind(null, m.id)}>
                      <button type="submit" className="text-gray-400 hover:text-blue-600 text-xs underline">Duplicate</button>
                    </form>
                    <Link href={`/materials/${m.id}/edit`} className="text-gray-400 hover:text-gray-900 text-xs underline">Edit</Link>
                  </div>
                </td>
              </tr>
            );
          })}
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
        <span className="ml-3 text-gray-300">— double-click any cell to edit</span>
      </div>
    </div>
  );
}
