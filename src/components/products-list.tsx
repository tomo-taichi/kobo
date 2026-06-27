"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { duplicateProduct, deleteProduct } from "@/app/actions/products";

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
  // Enabled colours with per-colour pricing (product_colors)
  product_colors?: { retail_price_eur: number | null; wholesale_eur: number | null; material_colors: { color: string } | null }[];
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

function eurInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return `€${Math.round(v).toLocaleString("en-US")}`;
}

// A € range across the product's enabled colours (single value if all equal), with a fallback.
function priceRange(vals: number[], fallback: number | null): string {
  const xs = vals.filter((v) => v > 0);
  if (xs.length === 0) return fallback && fallback > 0 ? eurInt(fallback) : "—";
  const min = Math.min(...xs), max = Math.max(...xs);
  return min === max ? eurInt(min) : `${eurInt(min)}–${eurInt(max)}`;
}

function colourNamesOf(p: ProductRow): string {
  const names = (p.product_colors ?? []).map((c) => c.material_colors?.color).filter(Boolean) as string[];
  if (names.length > 0) return names.join(", ");
  return p.main_m_color ?? "—";
}
function idealWsOf(p: ProductRow): string {
  return priceRange((p.product_colors ?? []).map((c) => Number(c.wholesale_eur ?? 0)), p.wholesale_eur);
}
function retailOf(p: ProductRow): string {
  return priceRange((p.product_colors ?? []).map((c) => Number(c.retail_price_eur ?? 0)), p.retail_price_eur);
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

// Shared context for a model group's header: Season · Sex · Category (distinct values)
function groupMeta(rows: ProductRow[]): string {
  const uniq = (vals: (string | null | undefined)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v)));
  const seasons = uniq(rows.map((r) => r.seasons?.name));
  const sexes   = uniq(rows.map((r) => r.product_sex));
  const cats    = uniq(rows.map((r) => r.product_category));
  return [seasons.join("/"), sexes.join("/"), cats.join("/")].filter(Boolean).join(" · ");
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

// ─── Per-row delete (always confirms before deleting) ─────────────────
function RowDeleteButton({ productId, label }: { productId: string; label: string | null }) {
  const [open,    setOpen]    = useState(false);
  const [pending, setPending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteProduct(productId); // on success, redirects to /products
    if (result) { setError(result); setPending(false); }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 rounded px-2 py-0.5 hover:border-red-400"
      >
        Del
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">⚠</div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Delete product?</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  <span className="font-medium text-gray-700">{label ?? "This product"}</span>
                  {" "}will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={pending}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
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

// ─── Compact row (grouped modes) ─────────────────────────────────────
// Season / Sex / Model / Category live in the group header. Prices are a read-only
// per-colour summary (Ideal WS / Retail ranges); edit per colour in the cost form.
function CompactRow({ p, showModel = false }: { p: ProductRow; showModel?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 hover:bg-gray-50 transition-colors text-xs ${p.is_invalid ? "opacity-40" : ""}`}>
      <span className="font-mono text-gray-400 w-24 shrink-0">
        {fmtId(p.product_number)}
        {p.is_sample && <span className="ml-1 text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded">S</span>}
      </span>

      {showModel && (
        <Link href={`/products/${p.id}/edit`} className="w-40 shrink-0 truncate text-gray-800 hover:underline font-medium">
          {p.model_name ?? "—"}
        </Link>
      )}

      {/* Main Material */}
      <span className="w-40 shrink-0 truncate text-gray-600">{p.main_m_name ?? "—"}</span>

      {/* Enabled colours */}
      <span className="w-32 shrink-0 truncate text-gray-500" title={colourNamesOf(p)}>{colourNamesOf(p)}</span>

      <div className="w-px self-stretch bg-gray-200 mx-1" />

      {/* Ideal WS (range, read-only) */}
      <span className="w-20 text-right font-mono text-gray-400 shrink-0">{idealWsOf(p)}</span>
      {/* Retail (range, read-only) — Order-adopted price, edited per colour in the cost form */}
      <span className="w-24 text-right font-mono font-semibold text-gray-700 shrink-0">{retailOf(p)}</span>

      <div className="w-px self-stretch bg-gray-200 mx-1" />

      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/products/${p.id}/edit`}
          className="text-gray-400 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400">
          Edit
        </Link>
        <DupButton productId={p.id} />
        <RowDeleteButton productId={p.id} label={p.model_name} />
      </div>
    </div>
  );
}

// ─── Group header ────────────────────────────────────────────────────
function GroupHeader({ label, count, level = 0, meta }: { label: string; count: number; level?: number; meta?: string }) {
  return (
    <div className={`flex items-center gap-2 border-b text-xs ${
      level === 0
        ? "px-4 py-1.5 bg-gray-100 border-gray-200 font-semibold text-gray-700"
        : "px-4 py-1 pl-10 bg-gray-50 border-gray-100 font-medium text-gray-500 italic"
    }`}>
      <span>{label || "(no name)"}</span>
      {meta && <span className="font-normal text-gray-400">· {meta}</span>}
      <span className="ml-auto text-gray-400">{count} item{count !== 1 ? "s" : ""}</span>
    </div>
  );
}

// ─── Column header for compact modes ────────────────────────────────
function CompactColHeader({ showModel = false }: { showModel?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-1 bg-white border-b border-gray-200 text-[10px] text-gray-400 uppercase tracking-wide">
      <span className="w-24 shrink-0">ID</span>
      {showModel && <span className="w-40 shrink-0">Model</span>}
      <span className="w-40 shrink-0">Material</span>
      <span className="w-32 shrink-0">Colours</span>
      <div className="w-px mx-1" />
      <span className="w-20 text-right shrink-0">Ideal WS</span>
      <span className="w-24 text-right shrink-0">Retail (EUR)</span>
      <div className="w-px mx-1" />
      <span className="w-32 shrink-0" />
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

function PriceCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className={`font-mono ${bold ? "font-semibold text-gray-800" : "text-gray-500"}`}>{value}</span>
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

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.product_category).filter(Boolean))).sort() as string[],
    [products]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const matchModel    = p.model_name?.toLowerCase().includes(q);
        const matchMaterial = p.main_m_name?.toLowerCase().includes(q);
        const matchColor    = colourNamesOf(p).toLowerCase().includes(q);
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
            <GroupHeader label={model} count={rows.length} meta={groupMeta(rows)} />
            {rows.map((p) => <CompactRow key={p.id} p={p} />)}
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
              <GroupHeader label={model} count={modelRows.length} meta={groupMeta(modelRows)} />
              {innerGroups.map(([mat, matRows]) => (
                <div key={mat}>
                  <GroupHeader label={mat} count={matRows.length} level={1} />
                  {matRows.map((p) => <CompactRow key={p.id} p={p} />)}
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
        <CompactColHeader showModel />
        {groups.map(([mat, rows]) => (
          <div key={mat}>
            <GroupHeader label={mat} count={rows.length} />
            {rows.map((p) => <CompactRow key={p.id} p={p} showModel />)}
          </div>
        ))}
      </>
    );
  }

  // ── Flat card renderer ────────────────────────────────────────────

  function renderFlat(items: ProductRow[]) {
    return (
      <div className="divide-y divide-gray-100">
        {items.map((p) => (
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
                <RowDeleteButton productId={p.id} label={p.model_name} />
              </div>
            </div>

            {/* Row 2: meta + pricing */}
            <div className="flex items-start gap-5 text-xs flex-wrap">
              <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 min-w-[220px]">
                <MetaCell label="Material" value={p.main_m_name} />
                <MetaCell label="Colours"  value={colourNamesOf(p)} />
                <MetaCell label="Season"   value={p.seasons?.name ?? null} />
                <MetaCell label="Category" value={p.product_category} />
                <MetaCell label="Sex"      value={p.product_sex} />
                <MetaCell label="ID"       value={fmtId(p.product_number)} mono />
              </div>
              <div className="border-l border-gray-200 self-stretch" />
              <div className="grid grid-cols-2 gap-x-5 gap-y-0.5">
                <PriceCell label="Ideal WS" value={idealWsOf(p)} />
                <PriceCell label="Retail (EUR)" value={retailOf(p)} bold />
              </div>
            </div>
          </div>
        ))}
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
