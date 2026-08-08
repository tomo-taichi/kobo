"use client";

import { Fragment, useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateProduct, deleteProduct, bulkArchiveProducts, bulkDeleteProducts, bulkSetProductTag } from "@/app/actions/products";

export type ProductRow = {
  id: string;
  product_number: string | null;
  name: string | null;
  model_name: string | null;
  product_category: string | null;
  product_sex: string | null;
  is_sample: boolean;
  is_invalid: boolean;
  main_material_id?: string | null;
  wholesale_eur: number | null;
  retail_price_eur: number | null;
  main_m_name: string | null;
  main_m_color: string | null;
  seasons: { id: string; name: string } | null;
  product_colors?: { retail_price_eur: number | null; wholesale_eur: number | null; material_colors: { color: string } | null }[];
  main_thumbs?: string[];
  tags?: string[];
};

type Season = { id: string; name: string };
type SortKey = "id" | "model" | "category" | "material" | "retail";
type GroupMode = "none" | "model" | "material";

const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: "none",     label: "Flat" },
  { value: "model",    label: "By Model" },
  { value: "material", label: "By Material" },
];

// Fixed display order for the category filter (canonical labels). Anything not
// listed is appended at the end.
const CATEGORY_ORDER = [
  "Coat", "Jacket", "Trousers", "Knitwear", "Shirt", "T-shirt",
  "Accessories", "Watch", "Eyewear", "Shoes", "Bag", "Other",
];
const catRank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? CATEGORY_ORDER.length : i; };
// Emoji icon per category (tooltip shows the name).
const CATEGORY_ICON: Record<string, string> = {
  Coat: "🧥", Jacket: "🥼", Trousers: "👖", Knitwear: "🧶", Shirt: "👔", "T-shirt": "👕",
  Accessories: "💍", Watch: "⌚", Eyewear: "👓", Shoes: "👟", Bag: "👜", Other: "📦",
};

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  const digits = raw.replace(/^P/i, "");
  const n = parseInt(digits, 10);
  if (isNaN(n)) return raw;
  return "P" + String(n).padStart(6, "0");
}
function eurInt(v: number | null | undefined): string {
  if (v == null || v <= 0) return "—";
  return `€${Math.round(v).toLocaleString("en-US")}`;
}
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
const colourCount = (p: ProductRow) => (p.product_colors ?? []).length;
const idealWsOf = (p: ProductRow) => priceRange((p.product_colors ?? []).map((c) => Number(c.wholesale_eur ?? 0)), p.wholesale_eur);
const retailOf = (p: ProductRow) => priceRange((p.product_colors ?? []).map((c) => Number(c.retail_price_eur ?? 0)), p.retail_price_eur);
const retailNum = (p: ProductRow) => {
  const xs = (p.product_colors ?? []).map((c) => Number(c.retail_price_eur ?? 0)).filter((v) => v > 0);
  return xs.length ? Math.min(...xs) : Number(p.retail_price_eur ?? 0);
};

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
}
function CopyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>;
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>;
}

const rowBtn = "inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors";

// Shrink the model name font so long names stay on one line within a fixed width.
function modelFontClass(name: string): string {
  const n = name.length;
  if (n > 34) return "text-[10px]";
  if (n > 26) return "text-[11px]";
  if (n > 20) return "text-[13px]";
  return "text-sm";
}

function DupButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending} title="Duplicate"
      onClick={() => startTransition(() => { duplicateProduct(productId); })}
      className={rowBtn}><CopyIcon /></button>
  );
}

function RowDeleteButton({ productId, label }: { productId: string; label: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleDelete() {
    setPending(true); setError(null);
    const result = await deleteProduct(productId);
    if (result) { setError(result); setPending(false); }
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Delete"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"><TrashIcon /></button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">⚠</div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Delete product?</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  <span className="font-medium text-gray-700">{label ?? "This product"}</span> will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={pending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{pending ? "Deleting…" : "Yes, delete"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ProductsList({ products, seasons, tagOptions = [], initialCategory = "Coat" }: { products: ProductRow[]; seasons: Season[]; tagOptions?: string[]; initialCategory?: string }) {
  const router = useRouter();
  const [search, setSearch]       = useState("");
  const [fSeason, setFSeason]     = useState("");
  const [fCat, setFCat]           = useState(initialCategory); // default category view
  const [fSex, setFSex]           = useState("");
  const [fSample, setFSample]     = useState("");
  const [fTag, setFTag]           = useState("");
  const [sort, setSort]           = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "model", dir: 1 });
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [bulkPending, startBulk]  = useTransition();

  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSelected(new Set());
  const runBulk = (fn: () => Promise<string | null>) => startBulk(async () => {
    const err = await fn();
    if (err) alert(err);
    else { clearSel(); setTagMenuOpen(false); router.refresh(); }
  });

  const setSortKey = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const sexes = useMemo(() => Array.from(new Set(products.map((p) => p.product_sex).filter(Boolean))).sort() as string[], [products]);
  const allTags = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) for (const t of p.tags ?? []) m[t] = (m[t] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [products]);
  // Season filter order: "ALLSS" pinned first, then the rest as given (recency desc).
  const seasonOrder = useMemo(() => [...seasons.filter((s) => s.name === "ALLSS"), ...seasons.filter((s) => s.name !== "ALLSS")], [seasons]);

  // Everything except the category filter → live category counts.
  const preCat = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const hit = p.model_name?.toLowerCase().includes(q) || p.main_m_name?.toLowerCase().includes(q)
          || colourNamesOf(p).toLowerCase().includes(q) || fmtId(p.product_number).toLowerCase().includes(q)
          || (p.tags ?? []).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (fSeason && p.seasons?.id !== fSeason) return false;
      if (fSex && p.product_sex !== fSex) return false;
      if (fSample === "sample" && !p.is_sample) return false;
      if (fSample === "production" && p.is_sample) return false;
      if (fTag && !(p.tags ?? []).includes(fTag)) return false;
      return true;
    });
  }, [products, search, fSeason, fSex, fSample, fTag]);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of preCat) { const c = p.product_category ?? "—"; m[c] = (m[c] ?? 0) + 1; }
    return m;
  }, [preCat]);
  const categories = useMemo(
    () => Object.keys(catCounts).filter((c) => c !== "—").sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b)),
    [catCounts]
  );

  const filtered = useMemo(() => {
    const list = fCat ? preCat.filter((p) => p.product_category === fCat) : preCat;
    const { key, dir } = sort;
    const val = (p: ProductRow): string | number =>
      key === "id" ? Number((p.product_number ?? "0").replace(/\D/g, "")) || 0
      : key === "category" ? (p.product_category ?? "")
      : key === "material" ? (p.main_m_name ?? "").toLowerCase()
      : key === "retail" ? retailNum(p)
      : (p.model_name ?? "").toLowerCase();
    return [...list].sort((a, b) => { const av = val(a), bv = val(b); return av < bv ? -dir : av > bv ? dir : 0; });
  }, [preCat, fCat, sort]);

  const grouped = useMemo(() => {
    if (groupMode === "none") return [] as [string, ProductRow[]][];
    const map = new Map<string, ProductRow[]>();
    for (const p of filtered) {
      const k = (groupMode === "model" ? p.model_name : p.main_m_name) || "(none)";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupMode]);

  const hasFilters = search || fSeason || fCat || fSex || fSample || fTag;

  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");
  const th = "px-3 py-2 text-xs font-medium text-gray-500 select-none";
  const sTh = th + " cursor-pointer hover:text-gray-700";
  const td = "px-3 py-2";
  const seg = (active: boolean) => `px-3 py-1 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;
  const selCls = "px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10";

  function renderRow(p: ProductRow) {
    const nColors = colourCount(p);
    const thumb = (p.main_thumbs ?? [])[0];
    const isSel = selected.has(p.id);
    return (
      <tr key={p.id} onClick={() => window.open(`/products/${p.id}/edit`, "_blank", "noopener")}
        className={`cursor-pointer transition-colors ${isSel ? "bg-gray-50" : "hover:bg-gray-50/70"} ${p.is_invalid ? "opacity-40" : ""}`}>
        <td className={td} onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={isSel} onChange={() => toggleSel(p.id)} aria-label={`Select ${p.model_name ?? ""}`} className="align-middle accent-gray-900" />
        </td>

        {/* Category + Season above the ID */}
        <td className={td}>
          <div className="flex items-center gap-1.5">
            {p.product_category ? <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-700">{p.product_category}</span> : null}
            <span className="text-[11px] text-gray-400">{p.seasons?.name ?? "—"}</span>
          </div>
          <div className="font-mono text-gray-500 text-xs mt-0.5">{fmtId(p.product_number)}</div>
        </td>

        {/* Product: fixed width, model on one line (font shrinks), tags below */}
        <td className={td}>
          <div className="flex items-center gap-2">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="w-9 h-9 rounded object-cover border border-gray-200 bg-gray-50 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs shrink-0">🖼</div>
            )}
            <div className="w-56 shrink-0 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className={`${modelFontClass(p.model_name ?? "—")} font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis`} title={p.model_name ?? ""}>
                  {p.model_name ?? "—"}
                </span>
                {p.is_sample && <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-1 py-0.5 rounded shrink-0">S</span>}
              </div>
              {(p.tags ?? []).length > 0 && (
                <div className="flex flex-nowrap gap-1 mt-0.5 overflow-hidden">
                  {(p.tags ?? []).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 whitespace-nowrap">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Main Material (1 line, fixed width) with Colours below */}
        <td className={td}>
          <div className="w-44 overflow-hidden">
            <div className="text-gray-700 text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={p.main_m_name ?? ""}>{p.main_m_name ?? "—"}</div>
            <div className={`text-[11px] whitespace-nowrap overflow-hidden text-ellipsis ${nColors >= 2 ? "text-gray-500 underline decoration-dotted" : "text-gray-500"}`}
              title={colourNamesOf(p)}>
              {nColors >= 2 ? `${nColors} colours` : colourNamesOf(p)}
            </div>
          </div>
        </td>

        <td className={`${td} text-right font-mono text-gray-400 text-xs`}>{idealWsOf(p)}</td>
        <td className={`${td} text-right font-mono font-semibold text-gray-700`}>{retailOf(p)}</td>
        <td className={`${td} text-right`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <DupButton productId={p.id} />
            <RowDeleteButton productId={p.id} label={p.model_name} />
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
            <button type="button" onClick={() => setFCat("")} className={seg(fCat === "")} title="All categories">
              All <span className="opacity-50">{preCat.length}</span>
            </button>
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setFCat(c)} className={seg(fCat === c) + " flex items-center gap-1"} title={c} aria-label={c}>
                <span className="text-base leading-none">{CATEGORY_ICON[c] ?? "🏷"}</span>
                <span className="opacity-50 text-xs">{catCounts[c] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="ml-auto relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
            <input type="text" placeholder="Search model, ID or colour..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={fSeason} onChange={(e) => setFSeason(e.target.value)} className={selCls} aria-label="Season">
            <option value="">All Seasons</option>
            {seasonOrder.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={fSex} onChange={(e) => setFSex(e.target.value)} className={selCls} aria-label="Sex">
            <option value="">All Sex</option>
            {sexes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fSample} onChange={(e) => setFSample(e.target.value)} className={selCls} aria-label="Sample">
            <option value="">All</option>
            <option value="sample">Sample only</option>
            <option value="production">Production only</option>
          </select>
          <select value={fTag} onChange={(e) => setFTag(e.target.value)} className={selCls} aria-label="Tag">
            <option value="">All Tags</option>
            {allTags.map(([t, n]) => <option key={t} value={t}>{t} ({n})</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-400">Group</span>
            <div className="flex rounded-lg bg-gray-100 p-0.5">
              {GROUP_OPTIONS.map((g) => (
                <button key={g.value} type="button" onClick={() => setGroupMode(g.value)} className={seg(groupMode === g.value)}>{g.label}</button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setFSeason(""); setFCat(""); setFSex(""); setFSample(""); setFTag(""); }} className="text-xs text-gray-400 hover:text-gray-700 underline">Clear</button>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox" aria-label="Select all"
                  checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())}
                  className="align-middle accent-gray-900" />
              </th>
              <th className={sTh + " text-left w-28"} onClick={() => setSortKey("id")}>Cat / Season / ID{arrow("id")}</th>
              <th className={sTh + " text-left"} onClick={() => setSortKey("model")}>Product{arrow("model")}</th>
              <th className={sTh + " text-left"} onClick={() => setSortKey("material")}>Material / Colour{arrow("material")}</th>
              <th className={th + " text-right whitespace-nowrap"}>WS €</th>
              <th className={sTh + " text-right whitespace-nowrap"} onClick={() => setSortKey("retail")}>Retail €{arrow("retail")}</th>
              <th className={th + " w-16"}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groupMode === "none"
              ? filtered.map(renderRow)
              : grouped.map(([key, rows]) => (
                  <Fragment key={key}>
                    <tr className="bg-gray-50/80 border-t border-b border-gray-200">
                      <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {key} <span className="text-gray-400 font-normal">({rows.length})</span>
                      </td>
                    </tr>
                    {rows.map(renderRow)}
                  </Fragment>
                ))}
            {!filtered.length && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">{hasFilters ? "No products match the filters" : "No products yet"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400">{filtered.length} of {products.length} products — click a row to edit</p>

      {/* Floating bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-gray-900 text-white rounded-xl shadow-lg px-2 py-1.5 text-sm">
          <span className="px-3 py-1 text-gray-300">{selected.size} selected</span>
          <span className="w-px h-5 bg-white/15" />
          <button type="button" disabled={bulkPending} onClick={() => runBulk(() => bulkArchiveProducts([...selected], true))}
            className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">Archive</button>
          <button type="button" disabled={bulkPending} onClick={() => runBulk(() => bulkArchiveProducts([...selected], false))}
            className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">Unarchive</button>
          <span className="w-px h-5 bg-white/15" />
          {/* Bulk tag */}
          <div className="relative">
            <button type="button" disabled={bulkPending} onClick={() => setTagMenuOpen((v) => !v)}
              className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">Tag ▾</button>
            {tagMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-200 py-1 min-w-44 max-h-72 overflow-y-auto">
                {tagOptions.length === 0 && <div className="px-3 py-1.5 text-xs text-gray-400">No tags — add in Settings</div>}
                {tagOptions.map((t) => (
                  <div key={t} className="flex items-center justify-between gap-2 px-3 py-1 hover:bg-gray-50 text-xs">
                    <span>{t}</span>
                    <span className="flex gap-1">
                      <button type="button" title="Add to selected" onClick={() => runBulk(() => bulkSetProductTag([...selected], t, true))}
                        className="px-1.5 rounded border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600">+</button>
                      <button type="button" title="Remove from selected" onClick={() => runBulk(() => bulkSetProductTag([...selected], t, false))}
                        className="px-1.5 rounded border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600">−</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <span className="w-px h-5 bg-white/15" />
          <button type="button" disabled={bulkPending}
            onClick={() => { if (confirm(`Delete ${selected.size} product(s)? This can't be undone.`)) runBulk(() => bulkDeleteProducts([...selected])); }}
            className="px-3 py-1 rounded-lg text-red-300 hover:bg-white/10 disabled:opacity-50">Delete</button>
          <span className="w-px h-5 bg-white/15" />
          <button type="button" onClick={clearSel} className="px-2 py-1 rounded-lg text-gray-400 hover:bg-white/10" aria-label="Clear selection">✕</button>
        </div>
      )}
    </div>
  );
}
