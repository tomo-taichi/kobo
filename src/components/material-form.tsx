"use client";

import { useActionState, useState, useRef } from "react";
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
    season_id?: string | null;
    color?: string;
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

export function MaterialForm({ action, suppliers, seasons = [], pastColors = [], initialData = {}, id, onCancel, autoSave = false }: Props) {
  const [error, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save (edit page): debounce-submit on change. Validation in handleSubmit blocks
  // invalid saves; the action returns "ok" without navigating away.
  function scheduleSave() {
    if (!autoSave || !id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => formRef.current?.requestSubmit(), 700);
  }
  const [comps, setComps] = useState<CompRow[]>(() => buildInitialComps(initialData));
  const [compError, setCompError] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorRow[]>(() => buildInitialColors(initialData));
  const [colorError, setColorError] = useState<string | null>(null);

  const total = comps.reduce((sum, r) => sum + (Number(r.pct) || 0), 0);

  const colorsPayload = JSON.stringify(
    colors
      .filter((c) => c.color.trim())
      .map((c) => ({
        color: c.color.trim(),
        unit_price_jpy: c.unitPrice.trim() === "" ? null : Number(c.unitPrice),
        set_price_jpy: c.setPrice.trim() === "" ? null : Number(c.setPrice),
      }))
  );

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
    // In auto-save mode, block invalid saves silently (the on-screen indicators already
    // show colour count / composition total) rather than flashing error text while typing.
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
    <form ref={formRef} action={formAction} onChange={scheduleSave} onSubmit={handleSubmit} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="colors_json" value={colorsPayload} />
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
                  {FABRIC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </optgroup>
                <optgroup label="Accessory Material">
                  {ACCESSORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
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
          </div>
        </div>
      </div>

      {/* ── Group 2: Colours ── */}
      <div>
        <SectionHeading>Colours <span className="normal-case font-normal tracking-normal text-gray-400">(at least one)</span></SectionHeading>
        {colorError && <p className="text-xs text-red-600 mb-2">{colorError}</p>}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center text-[11px] text-gray-400">
            <span className="flex-1">Colour (English)</span>
            <span className="w-24 text-right">Actual ¥</span>
            <span className="w-24 text-right">Set ¥</span>
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
              <input
                type="number" min="0" step="0.01"
                value={row.setPrice}
                onChange={(e) => handleColorChange(i, "setPrice", e.target.value)}
                placeholder="0"
                title="Set Price for this colour — used in the product's Raw Cost (blank = base)"
                className="w-24 px-2 py-2 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
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

      {/* ── Group 3: Sourcing & Pricing ── */}
      <div>
        <SectionHeading>Sourcing &amp; Pricing</SectionHeading>
        <div className="flex flex-col gap-3">
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
              {UNIT_TYPES.map((u) => (
                <option key={u} value={u}>{UNIT_TYPE_LABELS[u]}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-gray-400">Prices are set per colour above (Actual ¥ / Set ¥).</p>
        </div>
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
                {COMPOSITION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
                ))}
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
