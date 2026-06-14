"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MaterialPickerModal, type PickableMaterial } from "@/components/material-picker";
import { calcCostJpy, calcCostEur, calcWholesaleEur } from "@/lib/pricing";
import { fmtEur } from "@/lib/format";
import {
  GARMENT_TYPES,
  MANUFACTURING_COST_PRESETS,
  MANUFACTURING_COST_LABELS,
  type ManufacturingCostKey,
  type GarmentType,
} from "@/lib/presets";
import { updateProductCosts } from "@/app/actions/product-costs";

// ── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  { key: "sleeve_lining",  ja: "袖裏地",            en: "Sleeve Lining" },
  { key: "pocket_facing",  ja: "ポケットスレキ向布",  en: "Pocket Facing" },
  { key: "pocket_bag",     ja: "ポケットスレキ手前布", en: "Pocket Bag" },
  { key: "interfacing",    ja: "芯地",              en: "Interfacing" },
  { key: "accessories",    ja: "付属",              en: "Accessories" },
] as const;
type RoleKey = typeof ROLES[number]["key"];

const CATEGORY_TO_GARMENT: Record<string, GarmentType | null> = {
  "Coat": "COAT", "Jacket": "JACKET", "Trousers": "TROUSERS",
  "Knitwear": "JACKET", "Shirt": "SHIRT", "T-shirt": "TSHIRT",
  "Shoes": null, "Bag": null, "Watch": null, "Accessories": null,
  "Eyewear": null, "Other": null,
};

// ── Types ─────────────────────────────────────────────────────────────────────
type MaterialInfo = {
  id: string; materialNumber: string | null; name: string;
  color: string | null; setPriceJpy: number; unitType: string | null;
};
type AdditionalRow = { materialId: string; quantity: number; role: RoleKey };
type MfgState = {
  cutting: number; sewing: number; knitting: number;
  thread: number; finish: number; packing: number;
};
type Props = {
  productId: string; productCategory: string | null;
  mainMaterial: MaterialInfo | null; liningMaterial: MaterialInfo | null;
  initialMainQuantity: number; initialLiningQuantity: number;
  allMaterials: PickableMaterial[];
  initialAdditionalRows: { materialId: string; quantity: number; role: string }[];
  initialManufacturing: MfgState;
  initialCostEurRate: number; initialMarkupRate: number;
  initialSetWsPriceEur: number; initialRetailRate: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const MFG_KEYS = Object.keys(MANUFACTURING_COST_PRESETS) as ManufacturingCostKey[];
function fmt(n: number) { return n.toLocaleString("ja-JP", { maximumFractionDigits: 0 }); }
function isValidRole(r: string): r is RoleKey { return ROLES.some((x) => x.key === r); }

const qtyInputCls =
  "w-24 px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900";

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Manufacturing input: free-type number + quick-preset dropdown
function MfgInput({ mfgKey, value, onChange }: {
  mfgKey: ManufacturingCostKey; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min="0" step="100" value={value || ""} placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <select
        value=""
        onChange={(e) => { if (e.target.value !== "") onChange(Number(e.target.value)); }}
        className="h-[30px] text-xs border border-gray-200 rounded px-0.5 text-gray-400 bg-white focus:outline-none cursor-pointer"
        title="Quick-fill preset"
      >
        <option value="">▾</option>
        {GARMENT_TYPES.map((g) => (
          <option key={g} value={MANUFACTURING_COST_PRESETS[mfgKey][g]}>
            {g}: ¥{MANUFACTURING_COST_PRESETS[mfgKey][g].toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}

function MaterialCostRow({
  mat, quantity, onQuantityChange,
}: { mat: MaterialInfo; quantity: number; onQuantityChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {mat.materialNumber && <span className="text-xs font-mono text-gray-400">{mat.materialNumber}</span>}
          <span className="text-sm font-medium text-gray-900">{mat.name}</span>
          {mat.color && <span className="text-xs text-gray-500">/ {mat.color}</span>}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Set Price: ¥{fmt(mat.setPriceJpy)}{mat.unitType ? ` / ${mat.unitType}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input type="number" min="0" step="0.001" value={quantity || ""} placeholder="0"
          onChange={(e) => onQuantityChange(Number(e.target.value))} className={qtyInputCls} />
        {mat.unitType && <span className="text-xs text-gray-400 w-8 shrink-0">{mat.unitType}</span>}
      </div>
      <div className="text-sm font-mono text-gray-700 text-right w-24 shrink-0">
        ¥{fmt(mat.setPriceJpy * quantity)}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ProductCostForm({
  productId, productCategory,
  mainMaterial, liningMaterial,
  initialMainQuantity, initialLiningQuantity,
  allMaterials, initialAdditionalRows,
  initialManufacturing,
  initialCostEurRate, initialMarkupRate, initialSetWsPriceEur, initialRetailRate,
}: Props) {
  const [mainQty,    setMainQty]    = useState(initialMainQuantity);
  const [liningQty,  setLiningQty]  = useState(initialLiningQuantity);
  const [additional, setAdditional] = useState<AdditionalRow[]>(
    initialAdditionalRows.map((r) => ({ ...r, role: isValidRole(r.role) ? r.role : "accessories" }))
  );
  const [pickerRole, setPickerRole] = useState<RoleKey | null>(null);
  const [mfg,        setMfg]        = useState<MfgState>(initialManufacturing);
  const [eurRate,    setEurRate]    = useState(initialCostEurRate);
  const [markupRate, setMarkupRate] = useState(initialMarkupRate);
  const [setWsPrice, setSetWsPrice] = useState(initialSetWsPriceEur);
  const [retailRate, setRetailRate] = useState(initialRetailRate);

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError,  setSaveError]  = useState<string | null>(null);

  const materialMap = new Map(allMaterials.map((m) => [m.id, m]));

  // Live calculations
  const mainCost        = (mainMaterial?.setPriceJpy   ?? 0) * mainQty;
  const liningCost      = (liningMaterial?.setPriceJpy ?? 0) * liningQty;
  const additionalCost  = additional.reduce((sum, r) => {
    const m = materialMap.get(r.materialId);
    return sum + (m ? Number(m.set_price_jpy) : 0) * r.quantity;
  }, 0);
  const materialCostJpy = mainCost + liningCost + additionalCost;
  const mfgCost         = mfg.cutting + mfg.sewing + mfg.knitting + mfg.thread + mfg.finish + mfg.packing;
  const costJpy         = calcCostJpy(materialCostJpy, mfg);
  const costEur         = calcCostEur(costJpy, eurRate || 1);
  const idealWsEur      = calcWholesaleEur(costEur, markupRate);
  const retailEur       = setWsPrice * retailRate;

  // Autofill
  const autofillType = productCategory ? (CATEGORY_TO_GARMENT[productCategory] ?? null) : null;
  function handleAutofill() {
    if (!autofillType) return;
    setMfg({
      cutting:  MANUFACTURING_COST_PRESETS.cutting[autofillType],
      sewing:   MANUFACTURING_COST_PRESETS.sewing[autofillType],
      knitting: MANUFACTURING_COST_PRESETS.knitting[autofillType],
      thread:   MANUFACTURING_COST_PRESETS.thread[autofillType],
      finish:   MANUFACTURING_COST_PRESETS.finish[autofillType],
      packing:  MANUFACTURING_COST_PRESETS.packing[autofillType],
    });
  }

  // Auto-save: debounce 800ms, skip initial mount
  const isFirstRender = useRef(true);
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef     = useRef({ mainQty, liningQty, additional, mfg, eurRate, markupRate, setWsPrice, retailRate });
  latestRef.current   = { mainQty, liningQty, additional, mfg, eurRate, markupRate, setWsPrice, retailRate };

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(async () => {
      const v = latestRef.current;
      setSaveStatus("saving");
      setSaveError(null);
      const result = await updateProductCosts(
        productId, v.mainQty, v.liningQty,
        v.additional.filter((r) => r.materialId),
        v.mfg, v.eurRate, v.markupRate, v.setWsPrice, v.retailRate
      );
      if (result) { setSaveStatus("error"); setSaveError(result); }
      else { setSaveStatus("saved"); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainQty, liningQty, additional, mfg, eurRate, markupRate, setWsPrice, retailRate]);

  const handlePickerSelect = useCallback((m: PickableMaterial) => {
    if (!pickerRole) return;
    const role = pickerRole;
    setAdditional((prev) => [...prev, { materialId: m.id, quantity: 0, role }]);
    setPickerRole(null);
  }, [pickerRole]);

  const removeAdditional = useCallback((i: number) => {
    setAdditional((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const updateAdditionalQty = useCallback((i: number, qty: number) => {
    setAdditional((prev) => prev.map((r, idx) => idx === i ? { ...r, quantity: qty } : r));
  }, []);

  return (
    <div className="space-y-8">

      {/* ── Save status indicator ── */}
      <div className="flex justify-end h-5">
        {saveStatus === "saving" && <span className="text-xs text-gray-400">Saving…</span>}
        {saveStatus === "saved"  && <span className="text-xs text-green-600">✓ Saved</span>}
        {saveStatus === "error"  && <span className="text-xs text-red-500">{saveError ?? "Save failed"}</span>}
      </div>

      {/* ── Materials ── */}
      <SectionBlock title="Materials">
        <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
          <div className="flex-1">Material</div>
          <div className="w-24 text-right shrink-0">Qty</div>
          <div className="w-8 shrink-0" />
          <div className="w-24 text-right shrink-0">Cost</div>
        </div>

        {/* Main */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Main</p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
            {mainMaterial
              ? <MaterialCostRow mat={mainMaterial} quantity={mainQty} onQuantityChange={setMainQty} />
              : <p className="text-xs text-gray-400 italic">Main material not set — configure in Basic Info</p>
            }
          </div>
        </div>

        {/* Lining */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Lining</p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
            {liningMaterial
              ? <MaterialCostRow mat={liningMaterial} quantity={liningQty} onQuantityChange={setLiningQty} />
              : <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 italic">No lining material</span>
                  <span className="text-sm font-mono text-gray-400">¥0</span>
                </div>
            }
          </div>
        </div>

        {/* Others */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Others</p>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {ROLES.map((role, roleIdx) => {
              const rows = additional.map((r, i) => ({ ...r, idx: i })).filter((r) => r.role === role.key);
              return (
                <div key={role.key}
                  className={`px-4 py-2.5 bg-white ${roleIdx < ROLES.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600">
                      {role.ja}<span className="text-gray-400 font-normal ml-1.5">/ {role.en}</span>
                    </span>
                    <button type="button" onClick={() => setPickerRole(role.key)}
                      className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 hover:border-gray-400">
                      + Add
                    </button>
                  </div>
                  {rows.length > 0 ? (
                    <div className="space-y-2 pl-2">
                      {rows.map(({ idx, materialId, quantity }) => {
                        const m = materialMap.get(materialId);
                        if (!m) return null;
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {m.material_number && <span className="text-xs font-mono text-gray-400">{m.material_number}</span>}
                                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                                {m.color && <span className="text-xs text-gray-500">/ {m.color}</span>}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                Set Price: ¥{fmt(Number(m.set_price_jpy))}{m.unit_type ? ` / ${m.unit_type}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input type="number" min="0" step="0.001" value={quantity || ""} placeholder="0"
                                onChange={(e) => updateAdditionalQty(idx, Number(e.target.value))} className={qtyInputCls} />
                              {m.unit_type && <span className="text-xs text-gray-400 w-8 shrink-0">{m.unit_type}</span>}
                            </div>
                            <div className="flex items-center gap-2 w-24 shrink-0 justify-end">
                              <span className="text-sm font-mono text-gray-700">¥{fmt(Number(m.set_price_jpy) * quantity)}</span>
                              <button type="button" onClick={() => removeAdditional(idx)}
                                className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-gray-300 pl-2 italic">—</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Total material */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <div className="flex-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Material Cost</div>
          <div className="w-24 shrink-0" /><div className="w-8 shrink-0" />
          <div className="w-24 text-right font-mono font-semibold text-gray-900 shrink-0">¥{fmt(materialCostJpy)}</div>
        </div>
      </SectionBlock>

      {/* ── Manufacturing Costs ── */}
      <SectionBlock title="Manufacturing Costs">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">
            {productCategory ? `Category: ${productCategory}` : "No category set"}
          </p>
          {autofillType
            ? <button type="button" onClick={handleAutofill}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-200">
                Autofill for {autofillType}
              </button>
            : <span className="text-xs text-gray-300 italic">No preset for this category</span>
          }
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {MFG_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 shrink-0">{MANUFACTURING_COST_LABELS[key]}</label>
              <MfgInput mfgKey={key} value={mfg[key]}
                onChange={(v) => setMfg((prev) => ({ ...prev, [key]: v }))} />
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between text-xs">
          <span className="text-gray-400">Total Manufacturing</span>
          <span className="font-mono text-gray-600">¥{fmt(mfgCost)}</span>
        </div>
      </SectionBlock>

      {/* ── Cost Summary ── */}
      <SectionBlock title="Cost Summary">
        <div className="bg-gray-50 rounded-lg p-4 text-xs font-mono">

          {/* JPY breakdown */}
          <div className="space-y-1 mb-3">
            <SumRow label="Material Cost"  value={`¥ ${fmt(materialCostJpy)}`} />
            <SumRow label="Manufacturing"  value={`¥ ${fmt(mfgCost)}`} />
            <div className="border-t border-gray-200 pt-1.5">
              <SumRow label="Total Cost (JPY)" value={`¥ ${fmt(costJpy)}`} bold />
            </div>
          </div>

          {/* EUR conversion */}
          <div className="border-t border-gray-200 pt-3 mb-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center">
              <span className="text-gray-400 font-sans">÷ EUR Rate</span>
              <RateInput value={eurRate} step={1} onChange={setEurRate} />
              <span className="text-gray-400 font-sans text-right">JPY / EUR</span>

              <span className="text-gray-600 font-sans font-semibold">Cost (EUR)</span>
              <span className="text-gray-400 font-sans text-right col-span-1">=</span>
              <span className="text-gray-800 font-semibold text-right">€ {fmtEur(costEur)}</span>
            </div>
          </div>

          {/* Markup / Ideal WS */}
          <div className="border-t border-gray-200 pt-3 mb-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center">
              <span className="text-gray-400 font-sans">× Markup Rate</span>
              <RateInput value={markupRate} step={0.1} onChange={setMarkupRate} />
              <span className="text-gray-400 font-sans text-right">×</span>

              <span className="text-gray-400 font-sans">Ideal WS (ref)</span>
              <span className="text-gray-400 font-sans text-right col-span-1">=</span>
              <span className="text-gray-400 text-right">€ {fmtEur(idealWsEur)}</span>
            </div>
          </div>

          {/* Set WS + Retail */}
          <div className="border-t border-gray-200 pt-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center">
              <span className="text-gray-600 font-sans font-semibold">Set WS Price (EUR)</span>
              <input type="number" min="0" step="0.01" value={setWsPrice || ""} placeholder="0.00"
                onChange={(e) => setSetWsPrice(Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-400 rounded text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white font-semibold" />
              <span className="text-gray-400 font-sans text-right">EUR</span>

              <span className="text-gray-400 font-sans">× Retail Rate</span>
              <RateInput value={retailRate} step={0.1} onChange={setRetailRate} />
              <span className="text-gray-400 font-sans text-right">×</span>

              <span className="text-gray-800 font-sans font-bold text-sm col-span-1">Retail (EUR)</span>
              <span className="text-gray-600 font-sans text-right col-span-1">=</span>
              <span className="text-gray-900 font-bold text-sm text-right">€ {fmtEur(retailEur)}</span>
            </div>
          </div>

        </div>
      </SectionBlock>

      {pickerRole && (
        <MaterialPickerModal
          materials={allMaterials}
          onSelect={handlePickerSelect}
          onClose={() => setPickerRole(null)}
        />
      )}
    </div>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between font-sans ${bold ? "font-semibold text-gray-900" : "text-gray-500"}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function RateInput({ value, step, onChange }: { value: number; step: number; onChange: (v: number) => void }) {
  return (
    <input type="number" min="0" step={step} value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white" />
  );
}
