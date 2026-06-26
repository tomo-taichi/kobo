"use client";

import { useState, useMemo } from "react";
import { MATERIAL_CATEGORIES } from "@/lib/material-constants";

export type PickableMaterial = {
  id: string;
  material_number: string | null;
  name: string;
  color: string | null;
  category: string | null;
  set_price_jpy: number | null;
  unit_type: string | null;
  comp_1_label: string | null; comp_1_pct: number | null;
  comp_2_label: string | null; comp_2_pct: number | null;
  comp_3_label: string | null; comp_3_pct: number | null;
  comp_4_label: string | null; comp_4_pct: number | null;
  comp_5_label: string | null; comp_5_pct: number | null;
  colors?: { id: string; color: string }[];
  seasons: { name: string } | null;
};

function materialStatus(m: PickableMaterial): "Complete" | "Incomplete" {
  const compTotal = [m.comp_1_pct, m.comp_2_pct, m.comp_3_pct, m.comp_4_pct, m.comp_5_pct]
    .reduce<number>((sum, v) => sum + (v ?? 0), 0);
  return Number(m.set_price_jpy) > 0 && compTotal === 100 ? "Complete" : "Incomplete";
}

const filterCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-gray-900";

export function MaterialPickerModal({
  materials,
  onSelect,
  onClose,
}: {
  materials: PickableMaterial[];
  onSelect: (m: PickableMaterial) => void;
  onClose: () => void;
}) {
  const [search,   setSearch]   = useState("");
  const [searchId, setSearchId] = useState("");
  const [fCat,     setFCat]     = useState("");
  const [fSeason,  setFSeason]  = useState("");
  const [fColour,  setFColour]  = useState("");

  const seasons = useMemo(() => {
    const names = Array.from(new Set(materials.map((m) => m.seasons?.name).filter(Boolean))) as string[];
    return names.sort();
  }, [materials]);

  const colours = useMemo(() => {
    const vals = Array.from(new Set(materials.map((m) => m.color).filter(Boolean))) as string[];
    return vals.sort();
  }, [materials]);

  const filtered = useMemo(() => {
    let list = materials;
    if (search.trim())   list = list.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
    if (searchId.trim()) list = list.filter((m) => (m.material_number ?? "").toUpperCase().includes(searchId.toUpperCase()));
    if (fCat)    list = list.filter((m) => m.category === fCat);
    if (fSeason) list = list.filter((m) => m.seasons?.name === fSeason);
    if (fColour) list = list.filter((m) => m.color === fColour);
    return list;
  }, [materials, search, searchId, fCat, fSeason, fColour]);

  const hasFilter = search || searchId || fCat || fSeason || fColour;
  function clearAll() { setSearch(""); setSearchId(""); setFCat(""); setFSeason(""); setFColour(""); }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Select Material</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Filters — 2-column layout */}
        <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-2 gap-3">
          {/* Left: text searches */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className={filterCls}
            />
            <input
              type="text"
              placeholder="Search by ID (e.g. M000001)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className={filterCls}
            />
          </div>
          {/* Right: dropdowns */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={fCat}    onChange={(e) => setFCat(e.target.value)}    className={filterCls}>
                <option value="">All Categories</option>
                {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={fSeason} onChange={(e) => setFSeason(e.target.value)} className={filterCls}>
                <option value="">All Seasons</option>
                {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select value={fColour} onChange={(e) => setFColour(e.target.value)} className={filterCls + " flex-1"}>
                <option value="">All Colours</option>
                {colours.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} items</span>
              {hasFilter && (
                <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-700 underline whitespace-nowrap">Clear</button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Status</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Material ID</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Category</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Season</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Colour</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Set Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => { onSelect(m); onClose(); }}
                  className="hover:bg-blue-50 cursor-pointer"
                >
                  <td className="px-3 py-2">
                    {materialStatus(m) === "Complete"
                      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">● Complete</span>
                      : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">● Incomplete</span>
                    }
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs font-mono">{m.material_number ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium text-xs">{m.name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{m.category ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{m.seasons?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{m.color ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs text-right">
                    {m.set_price_jpy ? `¥${Number(m.set_price_jpy).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">No materials found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
