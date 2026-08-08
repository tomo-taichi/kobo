"use client";

import { useActionState, useState, useRef, startTransition } from "react";
import {
  FABRIC_CATEGORIES,
  ACCESSORY_CATEGORIES,
  UNIT_TYPES,
  CATEGORY_LABELS,
  UNIT_TYPE_LABELS,
  COMPOSITION_GROUPS,
  MAX_COMPOSITIONS,
} from "@/lib/material-constants";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;
type Supplier = { id: string; name: string };
type Season   = { id: string; name: string };
type CompRow  = { label: string; pct: string };
type ColorRow = { color: string; unitPrice: string; setPrice: string };

type Props = {
  action: Action;
  suppliers: Supplier[];
  seasons?: Season[];
  pastColors?: string[];
  initialData?: {
    name?: string;
    category?: string;
    unit_price_jpy?: number;
    set_price_jpy?: number;
    unit_type?: string;
    supplier_id?: string | null;
    supplier_item_code?: string | null;
    season_id?: string | null;
    color?: string;
    price_uniform?: boolean;
    colors?: { color: string; unit_price_jpy: number | null; set_price_jpy: number | null }[];
    comp_1_label?: string; comp_1_pct?: number | null;
    comp_2_label?: string; comp_2_pct?: number | null;
    comp_3_label?: string; comp_3_pct?: number | null;
    comp_4_label?: string; comp_4_pct?: number | null;
    comp_5_label?: string; comp_5_pct?: number | null;
  };
  id?: string;
  onCancel?: () => void;
  autoSave?: boolean;
  fabricCategoryOptions?: { value: string; label: string }[];
  accessoryCategoryOptions?: { value: string; label: string }[];
  unitOptions?: { value: string; label: string }[];
  compositionOptions?: string[];
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";

function buildInitialComps(d: Props["initialData"]): CompRow[] {
  const rows: CompRow[] = [];
  for (let i = 1; i <= MAX_COMPOSITIONS; i++) {
    const label = (d as Record<string, unknown>)?.[`comp_${i}_label`] as string | undefined;
    const pct   = (d as Record<string, unknown>)?.[`comp_${i}_pct`]   as number | null | undefined;
    if (label) rows.push({ label, pct: pct != null ? String(pct) : "" });
  }
  return rows.length > 0 ? rows : [{ label: "", pct: "" }];
}

function buildInitialColors(d: Props["initialData"]): ColorRow[] {
  if (d?.colors && d.colors.length > 0) {
    return d.colors.map((c) => ({
      color: c.color,
      unitPrice: c.unit_price_jpy != null ? String(c.unit_price_jpy) : "",
      setPrice: c.set_price_jpy != null ? String(c.set_price_jpy) : "",
    }));
  }
  if (d?.color) return [{ color: d.color, unitPrice: "", setPrice: "" }];
  return [{ color: "", unitPrice: "", setPrice: "" }];
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
      {children}
    </h3>
  );
}

export function MaterialForm({
  action,
  suppliers,
  seasons = [],
  pastColors = [],
  initialData = {},
  id,
  onCancel,
  autoSave = false,
  fabricCategoryOptions = FABRIC_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c })),
  accessoryCategoryOptions = ACCESSORY_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] ?? c })),
  unitOptions = UNIT_TYPES.map((u) => ({ value: u, label: UNIT_TYPE_LABELS[u] ?? u })),
  compositionOptions = COMPOSITION_GROUPS.flatMap((g) => g.items),
}: Props) {
  const [error, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Composition select: render the canonical grouped options, plus any managed
  // options that aren't part of a group (shown under "Other").
  const groupedComps = new Set(COMPOSITION_GROUPS.flatMap((g) => g.items));
  const compExtras = compositionOptions.filter((o) => !groupedComps.has(o));

  const [comps, setComps] = useState<CompRow[]>(() => buildInitialComps(initialData));
  const [compError, setCompError] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorRow[]>(() => buildInitialColors(initialData));
  const [colorError, setColorError] = useState<string | null>(null);
  const [priceUniform, setPriceUniform] = useState<boolean>(initialData.price_uniform ?? true);
  // Uniform Set ¥ seed: first colour's set price (or blank).
  const [uniformSet, setUniformSet] = useState<string>(() => {
    const first = buildInitialColors(initialData)[0];
    return first?.setPrice ?? "";
  });

  const total = comps.reduce((sum, r) => sum + (Number(r.pct) || 0), 0);

  // When uniform, every colour's Set ¥ is the single uniform value.
  const colorsPayload = JSON.stringify(
    colors
      .filter((c) => c.color.trim())
      .map((c) => ({
        color: c.color.trim(),
        unit_price_jpy: c.unitPrice.trim() === "" ? null : Number(c.unitPrice),
        set_price_jpy: priceUniform
          ? (uniformSet.trim() === "" ? null : Number(uniformSet))
          : (c.setPrice.trim() === "" ? null : Number(c.setPrice)),
      }))
  );

  // Lightweight guard for auto-save. Requires ≥1 named colour and no duplicate
  // colours (both would error server-side). Composition MAY be partial — it saves
  // as a draft and the material simply shows "Incomplete" until it totals 100%.
  function canAutosave(): boolean {
    const named = colors.filter((c) => c.color.trim());
    if (named.length === 0) return false;
    const seen = new Set<string>();
    for (const c of named) {
      const k = c.color.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  }

  // Auto-save (edit modal): debounced. Dispatch the action directly with a FormData
  // snapshot instead of form.requestSubmit(). Native submission (a) makes React 19
  // auto-reset the form, reverting the field just edited, and (b) routes through the
  // onSubmit gate that blocks EVERY save until composition totals 100% — so partial
  // composition edits silently never persisted. Direct dispatch keeps state intact
  // and lets partial edits save as a draft.
  function scheduleSave() {
    if (!autoSave || !id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const form = formRef.current;
      if (form && canAutosave()) startTransition(() => formAction(new FormData(form)));
    }, 700);
  }

  function handleCompChange(i: number, field: "label" | "pct", value: string) {
    setComps((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    setCompError(null);
  }

  function addRow() {
    if (comps.length < MAX_COMPOSITIONS) setComps((prev) => [...prev, { label: "", pct: "" }]);
  }

  function removeRow(i: number) {
    if (comps.length > 1) { setComps((prev) => prev.filter((_, idx) => idx !== i)); scheduleSave(); }
  }

  function handleColorChange(i: number, field: "color" | "unitPrice" | "setPrice", value: string) {
    setColors((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    setColorError(null);
  }
  function addColor() { setColors((prev) => [...prev, { color: "", unitPrice: "", setPrice: "" }]); }
  function removeColor(i: number) { if (colors.length > 1) { setColors((prev) => prev.filter((_, idx) => idx !== i)); scheduleSave(); } }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Auto-save persists via direct dispatch (scheduleSave); never let a native
    // submit (e.g. pressing Enter in a field) run here — it would re-trigger the
    // React 19 form-reset. This is only the validation gate for the manual create flow.
    if (autoSave) { e.preventDefault(); return; }
    if (colors.filter((c) => c.color.trim()).length === 0) {
      e.preventDefault();
      if (!autoSave) setColorError("At least one colour is required");
      return;
    }
    const seen = new Set<string>();
    for (const c of colors) {
      const key = c.color.trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) { e.preventDefault(); if (!autoSave) setColorError(`Duplicate colour: ${c.color.trim()}`); return; }
      seen.add(key);
    }
    const filled = comps.filter((r) => r.label && r.pct);
    if (filled.length === 0) {
      e.preventDefault();
      if (!autoSave) setCompError("At least one composition entry is required");
      return;
    }
    if (total !== 100) {
      e.preventDefault();
      if (!autoSave) setCompError(`Total is ${total}%. Must equal 100%`);
      return;
    }
  }

  return (
    <form ref={formRef} action={formAction} onChange={scheduleSave} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="colors_json" value={colorsPayload} />
      <input type="hidden" name="price_uniform" value={priceUniform ? "true" : "false"} />
      {pastColors.length > 0 && (
        <datalist id="past-colours">
          {pastColors.map((c) => <option key={c} value={c} />)}
        </datalist>
      )}
      {error && error !== "ok" && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
      {autoSave && (
        <div className="flex justify-end h-4 -mt-2">
          {pending ? <span className="text-xs text-gray-400">Saving…</span>
            : error === "ok" ? <span className="text-xs text-green-600">✓ Saved</span>
            : null}
        </div>
      )}

      {/* ── Group 1: Material Info ── */}
      <div>
        <SectionHeading>Material Info</SectionHeading>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Material Name <span className="text-red-500">*</span>
              <span className="ml-1 text-gray-400 font-normal">(English)</span>
            </label>
            <input
              name="name"
              defaultValue={initialData.name ?? ""}
              required
              lang="en-GB"
              spellCheck
              placeholder="e.g. Wool Gabardine"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
              <select name="category" defaultValue={initialData.category ?? ""} required className={inputCls + " bg-white"}>
                <option value="">Select...</option>
                <optgroup label="Fabric">
                  {fabricCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Accessory Material">
                  {accessoryCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Season <span className="text-red-500">*</span></label>
              <select name="season_id" defaultValue={initialData.season_id ?? ""} required className={inputCls + " bg-white"}>
                <option value="">— Select —</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
              <select name="supplier_id" defaultValue={initialData.supplier_id ?? ""} className={inputCls + " bg-white"}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit <span className="text-red-500">*</span></label>
              <select name="unit_type" defaultValue={initialData.unit_type ?? ""} required className={inputCls + " bg-white"}>
                <option value="">Select...</option>
                {unitOptions.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Supplier Item Code
              <span className="ml-1 text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              name="supplier_item_code"
              defaultValue={initialData.supplier_item_code ?? ""}
              placeholder="Supplier's own code for this material, e.g. WK2101"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Group 2: Colours ── */}
      <div>
        <SectionHeading>Colours <span className="normal-case font-normal tracking-normal text-gray-400">(at least one)</span></SectionHeading>
        {colorError && <p className="text-xs text-red-600 mb-2">{colorError}</p>}

        {/* Set-price mode: one price for all colours (editable in the list), or per-colour. */}
        <div className="flex items-center gap-4 mb-2 text-xs">
          <span className="text-gray-500">Set ¥ pricing:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="_price_mode" checked={priceUniform} onChange={() => { setPriceUniform(true); scheduleSave(); }} /> Uniform (all colours)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="_price_mode" checked={!priceUniform} onChange={() => { setPriceUniform(false); scheduleSave(); }} /> Per colour
          </label>
        </div>
        {priceUniform && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">Set ¥ (all colours)</span>
            <input type="number" min="0" step="0.01" value={uniformSet}
              onChange={(e) => { setUniformSet(e.target.value); scheduleSave(); }}
              placeholder="0"
              className="w-28 px-2 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <span className="text-[11px] text-gray-400">— also editable from the Materials list</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center text-[11px] text-gray-400">
            <span className="flex-1">Colour (English)</span>
            <span className="w-24 text-right">Actual ¥</span>
            {!priceUniform && <span className="w-24 text-right">Set ¥</span>}
            <span className="w-4" />
          </div>
          {colors.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                list={pastColors.length > 0 ? "past-colours" : undefined}
                value={row.color}
                onChange={(e) => handleColorChange(i, "color", e.target.value)}
                lang="en-GB"
                spellCheck
                placeholder="e.g. Navy Blue"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <input
                type="number" min="0" step="0.01"
                value={row.unitPrice}
                onChange={(e) => handleColorChange(i, "unitPrice", e.target.value)}
                placeholder="0"
                title="Actual Unit Price for this colour (blank = base)"
                className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              {!priceUniform && (
                <input
                  type="number" min="0" step="0.01"
                  value={row.setPrice}
                  onChange={(e) => handleColorChange(i, "setPrice", e.target.value)}
                  placeholder="0"
                  title="Set Price for this colour — used in the product's Raw Cost (blank = base)"
                  className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              )}
              {colors.length > 1 && (
                <button type="button" onClick={() => removeColor(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none w-4">×</button>
              )}
              {colors.length <= 1 && <span className="w-4" />}
            </div>
          ))}
          <button type="button" onClick={addColor} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 w-fit hover:bg-gray-50 mt-1">
            + Add colour
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5"><span className="font-medium">Set ¥</span> per colour drives the product&apos;s Raw Cost; Actual ¥ is the real purchase price. Enter each colour&apos;s prices (they can differ, e.g. special dyeing).</p>
      </div>

      {/* ── Group 4: Composition ── */}
      <div>
        <SectionHeading>
          Composition
          <span className={`ml-2 normal-case font-normal tracking-normal ${total === 100 ? "text-green-600" : "text-gray-400"}`}>
            Total: {total}%
          </span>
        </SectionHeading>
        {compError && <p className="text-xs text-red-600 mb-2">{compError}</p>}
        <div className="flex flex-col gap-2">
          {comps.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input type="hidden" name={`comp_${i + 1}_label`} value={row.label} />
              <input type="hidden" name={`comp_${i + 1}_pct`}   value={row.pct} />
              <select
                value={row.label}
                onChange={(e) => handleCompChange(i, "label", e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">— Select —</option>
                {/* Keep the current (possibly imported/custom) value selectable even if
                    it isn't one of the grouped options. */}
                {row.label && !groupedComps.has(row.label) && (
                  <option value={row.label}>{row.label}</option>
                )}
                {COMPOSITION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                ))}
                {compExtras.length > 0 && (
                  <optgroup label="Other">
                    {compExtras.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="1" max="100"
                  value={row.pct}
                  onChange={(e) => handleCompChange(i, "pct", e.target.value)}
                  placeholder="0"
                  className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              {comps.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 text-lg leading-none">×</button>
              )}
            </div>
          ))}
          {comps.length < MAX_COMPOSITIONS && (
            <button type="button" onClick={addRow} className="text-xs text-gray-500 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 w-fit hover:bg-gray-50 mt-1">
              + Add row
            </button>
          )}
        </div>
      </div>

      {!autoSave && (
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={pending} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
            {pending ? "Saving..." : id ? "Update" : "Create"}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}
