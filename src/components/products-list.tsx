"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { duplicateProduct, updateProductRetailPrice } from "@/app/actions/products";

export type ProductRow = {
  id: string;
  product_number: string | null;
  name: string | null;
  model_name: string | null;
  product_category: string | null;
  product_sex: string | null;
  is_sample: boolean;
  is_invalid: boolean;
  wholesale_eur: number | null;
  retail_price_eur: number | null;
  main_m_name: string | null;
  main_m_color: string | null;
  seasons: { id: string; name: string } | null;
};

type Season = { id: string; name: string };
type SortKey = "name" | "id" | "category" | "material";
type LayoutMode = "flat" | "A" | "B" | "C";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name",     label: "Name" },
  { value: "id",       label: "Product ID" },
  { value: "category", label: "Category" },
  { value: "material", label: "Main Material" },
];

const LAYOUT_OPTIONS: { value: LayoutMode; label: string; title: string }[] = [
  { value: "flat", label: "List",         title: "Flat list" },
  { value: "A",    label: "By Model",     title: "Grouped by Model Name" },
  { value: "B",    label: "Model × Mat.", title: "Grouped by Model + Main Material (2-level)" },
  { value: "C",    label: "By Material",  title: "Grouped by Main Material" },
];

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/^P/i, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return raw;
  return "P" + String(n).padStart(6, "0");
}

function fmtEur(v: number | null, bold = false) {
  if (!v && v !== 0) return <span className="text-gray-300">—</span>;
  const formatted = v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return (
    <span className={bold ? "font-semibold text-gray-800" : "text-gray-500"}>
      €{formatted}
    </span>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item) || "(none)";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

// ─── Duplicate button ────────────────────────────────────────────────
function DupButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => { duplicateProduct(productId); })}
      className="text-xs text-gray-400 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400 disabled:opacity-50"
    >
      {pending ? "…" : "Dup"}
    </button>
  );
}

// ─── Retail Price inline editor (the Order-adopted price, set manually) ───
function RetailPriceEditor({
  productId, retail, onSave,
}: {
  productId: string;
  retail: number | null;
  onSave: (productId: string, retail: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v) && v >= 0) {
      onSave(productId, v);
      updateProductRetailPrice(productId, v);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number" step="1" min="0" value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-16 text-xs text-right font-mono border border-blue-400 rounded px-1 focus:outline-none"
      />
    );
  }

  return (
    <span
      title="Double-click to edit"
      onDoubleClick={() => { setDraft(String(retail ?? "")); setEditing(true); }}
      className="cursor-default select-none hover:bg-gray-100 rounded px-0.5 tabular-nums font-mono font-semibold text-gray-700"
    >
      {retail ? `€${retail.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}
    </span>
  );
}

// ─── Compact row (grouped modes) ─────────────────────────────────────
function CompactRow({
  p, retailOverride, onRetailSave,
}: {
  p: ProductRow;
  retailOverride?: number;
  onRetailSave: (productId: string, retail: number) => void;
}) {
  const retail = retailOverride ?? p.retail_price_eur;

  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors text-xs ${p.is_invalid ? "opacity-40" : ""}`}>
      <span className="font-mono text-gray-400 w-[5rem] shrink-0">{fmtId(p.product_number)}</span>

      {/* Model Name */}
      <div className="flex items-center gap-1.5 w-36 shrink-0 min-w-0">
        <Link href={`/products/${p.id}/edit`}
          className="text-gray-800 hover:underline truncate font-medium">
          {p.model_name ?? "—"}
        </Link>
        {p.is_sample && (
          <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded shrink-0">S</span>
        )}
        {p.is_invalid && (
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded shrink-0">!</span>
        )}
      </div>

      {/* Main Material */}
      <span className="w-28 shrink-0 truncate text-gray-600">{p.main_m_name ?? "—"}</span>

      {/* Color */}
      <span className="w-20 shrink-0 truncate text-gray-500">{p.main_m_color ?? "—"}</span>

      <span className="text-gray-500 w-12 text-center shrink-0">{p.seasons?.name ?? "—"}</span>
      <span className="text-gray-500 w-16 text-center shrink-0">{p.product_category ?? "—"}</span>
      <span className="text-gray-400 w-6  text-center shrink-0">{p.product_sex ?? "—"}</span>

      <div className="w-px self-stretch bg-gray-200 mx-1" />

      {/* Ideal WS (reference, read-only) */}
      <span className="w-14 text-right font-mono text-gray-400 shrink-0">
        {p.wholesale_eur ? `€${p.wholesale_eur.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
      </span>
      {/* Retail (EUR) — Order-adopted price, editable inline */}
      <div className="w-20 text-right shrink-0">
        <RetailPriceEditor productId={p.id} retail={retail} onSave={onRetailSave} />
      </div>

      <div className="w-px self-stretch bg-gray-200 mx-1" />

      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/products/${p.id}/edit`}
          className="text-gray-400 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400">
          Edit
        </Link>
        <DupButton productId={p.id} />
      </div>
    </div>
  );
}

// ─── Group header ────────────────────────────────────────────────────
function GroupHeader({ label, count, level = 0 }: { label: string; count: number; level?: number }) {
  return (
    <div className={`flex items-center gap-2 border-b text-xs ${
      level === 0
        ? "px-4 py-1.5 bg-gray-100 border-gray-200 font-semibold text-gray-700"
        : "px-4 py-1 pl-10 bg-gray-50 border-gray-100 font-medium text-gray-500 italic"
    }`}>
      <span>{label || "(no name)"}</span>
      <span className="ml-auto text-gray-400">{count} item{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

// ─── Column header for compact modes ────────────────────────────────
function CompactColHeader() {
  return (
    <div className="flex items-center gap-2 px-4 py-1 bg-white border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wide">
      <span className="w-[5rem] shrink-0">ID</span>
      <span className="w-36 shrink-0">Model</span>
      <span className="w-28 shrink-0">Material</span>
      <span className="w-20 shrink-0">Color</span>
      <span className="w-12 text-center shrink-0">Season</span>
      <span className="w-16 text-center shrink-0">Category</span>
      <span className="w-6  text-center shrink-0">Sex</span>
      <div className="w-px mx-1" />
      <span className="w-14 text-right shrink-0">Ideal WS</span>
      <span className="w-20 text-right shrink-0">Retail (EUR)</span>
      <div className="w-px mx-1" />
      <span className="w-[4.5rem] shrink-0" />
    </div>
  );
}

// ─── Helpers for flat card mode ──────────────────────────────────────
function MetaCell({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1 min-w-0">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`truncate ${mono ? "font-mono text-gray-600" : "text-gray-600"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function PriceCell({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`shrink-0 ${muted ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────
export function ProductsList({ products, seasons }: { products: ProductRow[]; seasons: Season[] }) {
  const [search,         setSearch]         = useState("");
  const [filterSeason,   setFilterSeason]   = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [sortBy,         setSortBy]         = useState<SortKey>("name");
  const [layoutMode,     setLayoutMode]     = useState<LayoutMode>("flat");
  const [retailOverrides, setRetailOverrides] = useState<Record<string, number>>({});

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.product_category).filter(Boolean))).sort() as string[],
    [products]
  );

  function handleRetailSave(productId: string, retail: number) {
    setRetailOverrides((prev) => ({ ...prev, [productId]: retail }));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const matchModel    = p.model_name?.toLowerCase().includes(q);
        const matchMaterial = p.main_m_name?.toLowerCase().includes(q);
        const matchColor    = p.main_m_color?.toLowerCase().includes(q);
        const matchId       = fmtId(p.product_number).toLowerCase().includes(q);
        if (!matchModel && !matchMaterial && !matchColor && !matchId) return false;
      }
      if (filterSeason   && p.seasons?.id !== filterSeason)        return false;
      if (filterCategory && p.product_category !== filterCategory) return false;
      return true;
    });
  }, [products, search, filterSeason, filterCategory]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "id":       return fmtId(a.product_number).localeCompare(fmtId(b.product_number));
      case "category": return (a.product_category ?? "").localeCompare(b.product_category ?? "");
      case "material": return (a.main_m_name ?? "").localeCompare(b.main_m_name ?? "");
      default:         return (a.name ?? "").localeCompare(b.name ?? "");
    }
  }), [filtered, sortBy]);

  const hasFilters = search || filterSeason || filterCategory;

  // ── Grouped renderers ─────────────────────────────────────────────

  function renderGroupedA(items: ProductRow[]) {
    const groups = groupBy(items, (p) => p.model_name ?? "");
    return (
      <>
        <CompactColHeader />
        {groups.map(([model, rows]) => (
          <div key={model}>
            <GroupHeader label={model} count={rows.length} />
            {rows.map((p) => (
              <CompactRow key={p.id} p={p} retailOverride={retailOverrides[p.id]} onRetailSave={handleRetailSave} />
            ))}
          </div>
        ))}
      </>
    );
  }

  function renderGroupedB(items: ProductRow[]) {
    const outerGroups = groupBy(items, (p) => p.model_name ?? "");
    return (
      <>
        <CompactColHeader />
        {outerGroups.map(([model, modelRows]) => {
          const innerGroups = groupBy(modelRows, (p) => p.main_m_name ?? "");
          return (
            <div key={model}>
              <GroupHeader label={model} count={modelRows.length} />
              {innerGroups.map(([mat, matRows]) => (
                <div key={mat}>
                  <GroupHeader label={mat} count={matRows.length} level={1} />
                  {matRows.map((p) => (
                    <CompactRow key={p.id} p={p} retailOverride={retailOverrides[p.id]} onRetailSave={handleRetailSave} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </>
    );
  }

  function renderGroupedC(items: ProductRow[]) {
    const groups = groupBy(items, (p) => p.main_m_name ?? "");
    return (
      <>
        <CompactColHeader />
        {groups.map(([mat, rows]) => (
          <div key={mat}>
            <GroupHeader label={mat} count={rows.length} />
            {rows.map((p) => (
              <CompactRow key={p.id} p={p} retailOverride={retailOverrides[p.id]} onRetailSave={handleRetailSave} />
            ))}
          </div>
        ))}
      </>
    );
  }

  // ── Flat card renderer ────────────────────────────────────────────

  function renderFlat(items: ProductRow[]) {
    return (
      <div className="divide-y divide-gray-100">
        {items.map((p) => {
          const retail = retailOverrides[p.id] ?? p.retail_price_eur;
          return (
            <div key={p.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${p.is_invalid ? "opacity-40" : ""}`}>
              {/* Row 1: Model Name + badges + actions */}
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Link href={`/products/${p.id}/edit`}
                    className="text-sm font-medium text-gray-900 hover:text-gray-600 hover:underline">
                    {p.model_name ?? "—"}
                  </Link>
                  {p.is_sample && (
                    <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded shrink-0">SAMPLE</span>
                  )}
                  {p.is_invalid && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">invalid</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/products/${p.id}/edit`}
                    className="text-xs text-gray-400 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400">
                    Edit
                  </Link>
                  <DupButton productId={p.id} />
                </div>
              </div>

              {/* Row 2: meta + pricing */}
              <div className="flex items-start gap-5 text-xs flex-wrap">
                <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 min-w-[220px]">
                  <MetaCell label="Material" value={p.main_m_name} />
                  <MetaCell label="Color"    value={p.main_m_color} />
                  <MetaCell label="Season"   value={p.seasons?.name ?? null} />
                  <MetaCell label="Category" value={p.product_category} />
                  <MetaCell label="Sex"      value={p.product_sex} />
                  <MetaCell label="ID"       value={fmtId(p.product_number)} mono />
                </div>
                <div className="border-l border-gray-200 self-stretch" />
                <div className="grid grid-cols-2 gap-x-5 gap-y-0.5">
                  <PriceCell label="Ideal WS" value={fmtEur(p.wholesale_eur)} muted />
                  <PriceCell label="Retail (EUR)" value={
                    <RetailPriceEditor productId={p.id} retail={retail} onSave={handleRetailSave} />
                  } />
                </div>
              </div>
            </div>
          );
        })}
        {!items.length && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">No products found</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

      {/* Toolbar — row 1: Season + Search */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        <select value={filterSeason} onChange={(e) => setFilterSeason(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900">
          <option value="">All seasons</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="text" placeholder="Search name or ID…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-300 rounded text-sm w-52 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        {hasFilters && (
          <button type="button"
            onClick={() => { setSearch(""); setFilterSeason(""); setFilterCategory(""); }}
            className="text-xs text-gray-400 hover:text-gray-700 underline">
            Clear
          </button>
        )}
      </div>

      {/* Toolbar — row 2: Category buttons */}
      <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1 items-center">
        <button
          type="button"
          onClick={() => setFilterCategory("")}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
            filterCategory === ""
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilterCategory(c === filterCategory ? "" : c)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              filterCategory === c
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Toolbar — row 3: Layout + Sort */}
      <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.title}
              onClick={() => setLayoutMode(opt.value)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                layoutMode === opt.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-400">Sort:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-gray-900">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-1.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
        {sorted.length} product{sorted.length !== 1 ? "s" : ""}
        {hasFilters ? ` (filtered from ${products.length})` : ""}
      </div>

      {/* Content */}
      {layoutMode === "flat" && renderFlat(sorted)}
      {layoutMode === "A"    && renderGroupedA(sorted)}
      {layoutMode === "B"    && renderGroupedB(sorted)}
      {layoutMode === "C"    && renderGroupedC(sorted)}

      {sorted.length === 0 && layoutMode !== "flat" && (
        <div className="px-4 py-10 text-center text-sm text-gray-400">No products found</div>
      )}
    </div>
  );
}
