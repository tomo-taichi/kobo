"use client";

import { useState, useMemo } from "react";
import { addProductColorToOrder } from "@/app/actions/order-items";
import { fmtEur } from "@/lib/format";

// One row per (product, enabled colour) — adding creates one order line for that colour.
type Row = {
  productColorId:   string;
  productId:        string;
  product_number:   string | null;
  model_name:       string | null;
  main_m_name:      string | null;
  colour:           string | null;
  product_category: string | null;
  product_sex:      string | null;
  retail_price_eur: number | null;
  seasons: { id: string; name: string } | null;
};

type Season = { id: string; name: string };

type Props = {
  orderId:  string;
  products: Row[];
  seasons:  Season[];
};

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/^P/i, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return raw;
  return "P" + String(n).padStart(6, "0");
}

export function OrderProductPicker({ orderId, products, seasons }: Props) {
  const [isOpen,          setIsOpen]          = useState(false);
  const [search,          setSearch]          = useState("");
  const [filterSeasonId,  setFilterSeasonId]  = useState("");
  const [filterCategory,  setFilterCategory]  = useState("");
  const [added,           setAdded]           = useState<Set<string>>(new Set());
  const [pendingId,       setPendingId]       = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.product_category).filter(Boolean))).sort() as string[],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (added.has(p.productColorId)) return false;
      if (q) {
        const matchId     = fmtId(p.product_number).toLowerCase().includes(q);
        const matchModel  = p.model_name?.toLowerCase().includes(q);
        const matchColour = p.colour?.toLowerCase().includes(q);
        if (!matchId && !matchModel && !matchColour) return false;
      }
      if (filterSeasonId   && p.seasons?.id        !== filterSeasonId)  return false;
      if (filterCategory   && p.product_category   !== filterCategory)  return false;
      return true;
    });
  }, [products, search, filterSeasonId, filterCategory, added]);

  async function handleAdd(productColorId: string) {
    setPendingId(productColorId);
    setError(null);
    const result = await addProductColorToOrder(orderId, productColorId);
    if (result) {
      setError(result);
    } else {
      setAdded((prev) => new Set([...prev, productColorId]));
    }
    setPendingId(null);
  }

  function handleClose() {
    setIsOpen(false);
    // Reset filters so next open is clean, but keep `added` so UI stays consistent
    setSearch("");
    setFilterSeasonId("");
    setFilterCategory("");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
      >
        + Add Product
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

          {/* Modal panel */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Add Product</h2>
              <button type="button" onClick={handleClose}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none w-7 h-7 flex items-center justify-center">
                ×
              </button>
            </div>

            {/* Filters */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-2 shrink-0">
              {/* Row 1: Search + Season */}
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Search by ID or Model name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <select
                  value={filterSeasonId}
                  onChange={(e) => setFilterSeasonId(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  <option value="">All seasons</option>
                  {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {(search || filterSeasonId || filterCategory) && (
                  <button type="button"
                    onClick={() => { setSearch(""); setFilterSeasonId(""); setFilterCategory(""); }}
                    className="text-xs text-gray-400 hover:text-gray-700 underline whitespace-nowrap">
                    Clear
                  </button>
                )}
              </div>

              {/* Row 2: Category buttons */}
              <div className="flex flex-wrap gap-1">
                <button type="button"
                  onClick={() => setFilterCategory("")}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    filterCategory === ""
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
                  }`}>
                  All
                </button>
                {categories.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setFilterCategory(c === filterCategory ? "" : c)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      filterCategory === c
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Count bar */}
            <div className="px-5 py-1.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 shrink-0">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              {added.size > 0 && <span className="ml-2 text-green-600">✓ {added.size} added</span>}
            </div>

            {/* Product table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white border-b border-gray-200 z-10">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 whitespace-nowrap">ID</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Season</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Sex</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Model</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Material</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Color</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500 whitespace-nowrap">Retail</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((p) => (
                    <tr key={p.productColorId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">{fmtId(p.product_number)}</td>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{p.seasons?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-400">{p.product_sex ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-800 font-medium">{p.model_name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{p.main_m_name ?? "—"}</td>
                      <td className="px-4 py-2 text-gray-700 font-medium">{p.colour ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
                        {p.retail_price_eur ? `€ ${fmtEur(Number(p.retail_price_eur), 0)}` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          disabled={pendingId === p.productColorId}
                          onClick={() => handleAdd(p.productColorId)}
                          className="px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {pendingId === p.productColorId ? "…" : "+ Add"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {error && (
              <div className="px-5 py-2 bg-red-50 border-t border-red-100 text-sm text-red-600 shrink-0">
                {error}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end shrink-0">
              <button type="button" onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
