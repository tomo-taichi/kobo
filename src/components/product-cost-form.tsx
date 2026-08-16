"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type PickableMaterial } from "@/components/material-picker";
import { CollapsibleCard } from "@/components/collapsible-card";
import { setProductFinalized } from "@/app/actions/products";
import { calcCostJpy, calcCostEur, calcWholesaleEur, calcMfgAmountFromHours, mfgHoursToMinutes, mfgMinutesToAmounts } from "@/lib/pricing";
import { fmtEur } from "@/lib/format";
import {
  MANUFACTURING_CATEGORIES,
  MANUFACTURING_HOUR_PRESETS,
  MANUFACTURING_COST_LABELS,
  formatHours,
  type ManufacturingCostKey,
  type ManufacturingHourPresets,
  type ManufacturingCategory,
} from "@/lib/presets";
import { updateProductCosts } from "@/app/actions/product-costs";

// ── Role definitions ─────────────────────────────────────────────────────────
const ROLES = [
  { key: "sleeve_lining",  label: "Sleeve Lining" },
  { key: "pocket_facing",  label: "Pocket Facing" },
  { key: "pocket_bag",     label: "Pocket Bag" },
  { key: "interfacing",    label: "Interfacing" },
  { key: "accessories",    label: "Accessories" },
] as const;
type RoleKey = typeof ROLES[number]["key"];

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
// An enabled colour of this product (product_colors) + its main-material price.
type ColorRow = {
  productColorId: string;
  materialColorId: string;
  color: string;
  mainSetPriceJpy: number;  // main material's price for this colour (override or base)
  markupRate: number;
  retailRate: number;
  retailPriceEur: number;
};
type ColorEdit = { markup: number; retailRate: number; retailPrice: number };
type Props = {
  productId: string; productCategory: string | null;
  mainMaterial: MaterialInfo | null; liningMaterial: MaterialInfo | null;
  initialMainQuantity: number; initialLiningQuantity: number;
  allMaterials: PickableMaterial[];
  initialAdditionalRows: { materialId: string; quantity: number; role: string }[];
  initialManufacturing: MfgState;   // minutes per manufacturing step
  laborRate: number;                // company_settings.labor_rate_jpy_per_hour
  initialCostEurRate: number;
  colors: ColorRow[];
  presets: ManufacturingHourPresets; // manufacturing autofill matrix (Settings)
  retailMultiplier: number;          // retail = Ideal WS × this (captured per product)
  locked?: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const MFG_KEYS = Object.keys(MANUFACTURING_HOUR_PRESETS) as ManufacturingCostKey[];
function fmt(n: number) { return n.toLocaleString("ja-JP", { maximumFractionDigits: 0 }); }
function isValidRole(r: string): r is RoleKey { return ROLES.some((x) => x.key === r); }

const qtyInputCls =
  "w-24 px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-900";

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Manufacturing input: work-TIME in HOURS (1 decimal) + quick-preset dropdown, with derived ¥.
function MfgInput({ mfgKey, value, laborRate, presets, onChange }: {
  mfgKey: ManufacturingCostKey; value: number; laborRate: number; presets: ManufacturingHourPresets; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min="0" step="0.1" value={value || ""} placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <span className="text-[10px] text-gray-400 w-5 shrink-0">hr</span>
      <span className="text-[11px] font-mono text-gray-500 w-16 text-right shrink-0" title="hours × labor rate">
        ¥{fmt(calcMfgAmountFromHours(value, laborRate))}
      </span>
      <select
        value=""
        onChange={(e) => { if (e.target.value !== "") onChange(Number(e.target.value)); }}
        className="h-[30px] text-xs border border-gray-200 rounded px-0.5 text-gray-400 bg-white focus:outline-none cursor-pointer"
        title="Quick-fill preset"
      >
        <option value="">▾</option>
        {MANUFACTURING_CATEGORIES.map((g) => (
          <option key={g} value={presets[mfgKey][g]}>
            {g}: {formatHours(presets[mfgKey][g])}h
          </option>
        ))}
      </select>
    </div>
  );
}

// Read-only material row (Version-owned non-main materials — no qty input, no remove).
function ReadonlyMaterialRow({
  materialNumber, name, color, setPriceJpy, unitType, quantity,
}: { materialNumber: string | null; name: string; color: string | null; setPriceJpy: number; unitType: string | null; quantity: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {materialNumber && <span className="text-xs font-mono text-gray-400">{materialNumber}</span>}
          <span className="text-sm font-medium text-gray-900">{name}</span>
          {color && <span className="text-xs text-gray-500">/ {color}</span>}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Set Price: ¥{fmt(setPriceJpy)}{unitType ? ` / ${unitType}` : ""}
        </div>
      </div>
      <div className="text-xs text-gray-500 shrink-0 w-24 text-right">{quantity} {unitType ?? ""}</div>
      <div className="w-24 shrink-0 text-right text-sm font-mono text-gray-700">¥{fmt(setPriceJpy * quantity)}</div>
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
  laborRate,
  initialCostEurRate, colors,
  presets,
  retailMultiplier,
  locked = false,
}: Props) {
  const router = useRouter();
  const [lockPending, startLock] = useTransition();
  const clientDiscountPct = Math.round((1 - 1 / retailMultiplier) * 100);
  const toggleLock = () => startLock(async () => { await setProductFinalized(productId, !locked); router.refresh(); });
  const [mainQty,    setMainQty]    = useState(initialMainQuantity);
  // ADR-0011 §9.7 — lining qty and the "other" non-main materials are Version-owned and read-only
  // here (edit them on the Model version, see the Model Recipe card above). Fixed, not state.
  const liningQty = initialLiningQuantity;
  const additional: AdditionalRow[] = initialAdditionalRows.map((r) => ({
    ...r, role: isValidRole(r.role) ? r.role : "accessories",
  }));
  // DB stores minutes; the form edits HOURS. Convert minutes → hours on load.
  const [mfg,        setMfg]        = useState<MfgState>(() => ({
    cutting:  initialManufacturing.cutting  / 60,
    sewing:   initialManufacturing.sewing   / 60,
    knitting: initialManufacturing.knitting / 60,
    thread:   initialManufacturing.thread   / 60,
    finish:   initialManufacturing.finish   / 60,
    packing:  initialManufacturing.packing  / 60,
  }));
  const [eurRate,    setEurRate]    = useState(initialCostEurRate);
  const [colorEdits, setColorEdits] = useState<ColorEdit[]>(
    () => colors.map((c) => ({ markup: c.markupRate, retailRate: c.retailRate, retailPrice: c.retailPriceEur }))
  );

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError,  setSaveError]  = useState<string | null>(null);

  const materialMap = new Map(allMaterials.map((m) => [m.id, m]));

  // Live calculations — base (using each material's base price; main varies per colour)
  const liningCost      = (liningMaterial?.setPriceJpy ?? 0) * liningQty;
  const additionalCost  = additional.reduce((sum, r) => {
    const m = materialMap.get(r.materialId);
    return sum + (m ? Number(m.set_price_jpy) : 0) * r.quantity;
  }, 0);
  const nonMainCostJpy  = liningCost + additionalCost;
  const baseMainCost    = (mainMaterial?.setPriceJpy ?? 0) * mainQty;
  const baseMaterialCost = baseMainCost + nonMainCostJpy;
  // mfg is entered as HOURS; convert to minutes then derive the JPY amounts at the labor rate.
  const mfgAmounts      = mfgMinutesToAmounts(mfgHoursToMinutes(mfg), laborRate);
  const mfgCost         = calcCostJpy(0, mfgAmounts);
  const mfgHoursTotal   = mfg.cutting + mfg.sewing + mfg.knitting + mfg.thread + mfg.finish + mfg.packing;
  const baseCostJpy     = calcCostJpy(baseMaterialCost, mfgAmounts);

  // Per-colour derived values
  const colorCalc = (i: number) => {
    const c = colors[i];
    const e = colorEdits[i] ?? { markup: 3.0, retailRate: 3.5, retailPrice: 0 };
    const materialCost = c.mainSetPriceJpy * mainQty + nonMainCostJpy;
    const costJpy = materialCost + mfgCost;
    const costEur = calcCostEur(costJpy, eurRate || 1);
    const idealWs = calcWholesaleEur(costEur, e.markup);       // Ideal WS = Cost × Markup
    const ref     = idealWs * retailMultiplier;                // Retail (ref) = Ideal WS × captured multiplier
    return { costJpy, costEur, idealWs, ref };
  };

  // Autofill
  const autofillCat = productCategory && (MANUFACTURING_CATEGORIES as readonly string[]).includes(productCategory)
    ? (productCategory as ManufacturingCategory) : null;
  function handleAutofill() {
    if (!autofillCat) return;
    setMfg({
      cutting:  presets.cutting[autofillCat],
      sewing:   presets.sewing[autofillCat],
      knitting: presets.knitting[autofillCat],
      thread:   presets.thread[autofillCat],
      finish:   presets.finish[autofillCat],
      packing:  presets.packing[autofillCat],
    });
  }

  // Auto-save: debounce 800ms, skip initial mount. Only the Product-owned inputs drive saves now
  // (main qty, manufacturing, EUR rate, per-colour pricing) — non-main is Version-owned.
  const isFirstRender = useRef(true);
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef     = useRef({ mainQty, mfg, eurRate, colorEdits });
  latestRef.current   = { mainQty, mfg, eurRate, colorEdits };

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(async () => {
      const v = latestRef.current;
      setSaveStatus("saving");
      setSaveError(null);
      const result = await updateProductCosts(
        productId, v.mainQty,
        mfgHoursToMinutes(v.mfg), laborRate, v.eurRate,   // hours → minutes for storage
        colors.map((c, i) => ({
          productColorId: c.productColorId,
          markupRate:     v.colorEdits[i]?.markup ?? 3.0,
          retailRate:     retailMultiplier, // preserve product-captured multiplier
          retailPriceEur: v.colorEdits[i]?.retailPrice ?? 0,
        }))
      );
      if (result) { setSaveStatus("error"); setSaveError(result); }
      else { setSaveStatus("saved"); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainQty, mfg, eurRate, colorEdits]);

  function setColorField(i: number, field: keyof ColorEdit, v: number) {
    setColorEdits((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: v } : e));
  }

  const saveIndicator =
    saveStatus === "saving" ? <span className="text-xs text-gray-400">Saving…</span>
    : saveStatus === "saved" ? <span className="text-xs text-green-600">✓ Saved</span>
    : saveStatus === "error" ? <span className="text-xs text-red-500">{saveError ?? "Save failed"}</span>
    : locked ? <span className="text-xs font-medium text-amber-600">🔒 Locked</span>
    : null;

  return (
    <div className="space-y-4">
      {/* ══ Materials & Cost (collapsible) ══ */}
      <CollapsibleCard title="Materials & Cost" right={
        <div className="flex items-center gap-3">
          {saveIndicator}
          <button type="button" onClick={toggleLock} disabled={lockPending}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors disabled:opacity-50 ${locked ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100" : "border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"}`}
            title={locked ? "Cost is locked — click to unlock" : "Finalise & lock the cost"}>
            {locked ? "🔒 Cost locked · Unlock" : "🔓 Lock cost"}
          </button>
        </div>
      }>
      <fieldset disabled={locked} className="border-0 p-0 m-0 min-w-0 disabled:opacity-70">
      {/* ── Narrow zone: Materials + Manufacturing side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ── Materials ── */}
      <SectionBlock title="Materials">
        <div className="flex items-center gap-3 mb-3 text-xs text-gray-400">
          <div className="flex-1">Material</div>
          <div className="w-24 text-right shrink-0">Qty</div>
          <div className="w-8 shrink-0" />
          <div className="w-24 text-right shrink-0">Cost</div>
        </div>

        {/* Main */}
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Main</p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            {mainMaterial
              ? <MaterialCostRow mat={mainMaterial} quantity={mainQty} onQuantityChange={setMainQty} />
              : <p className="text-xs text-gray-400 italic">Main material not set — configure in Basic Info</p>
            }
          </div>
        </div>

        {/* Lining — Version-owned, read-only (edit on the Model version) */}
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Lining <span className="normal-case text-gray-300">· from Model recipe</span></p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            {liningMaterial ? (
              <ReadonlyMaterialRow
                materialNumber={liningMaterial.materialNumber} name={liningMaterial.name} color={liningMaterial.color}
                setPriceJpy={liningMaterial.setPriceJpy} unitType={liningMaterial.unitType} quantity={liningQty} />
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 italic">No lining material</span>
                <span className="text-sm font-mono text-gray-400">¥0</span>
              </div>
            )}
          </div>
        </div>

        {/* Others — Version-owned, read-only */}
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Others <span className="normal-case text-gray-300">· from Model recipe</span></p>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {ROLES.map((role, roleIdx) => {
              const rows = additional.filter((r) => r.role === role.key);
              return (
                <div key={role.key}
                  className={`px-3 py-2 bg-white ${roleIdx < ROLES.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="mb-1">
                    <span className="text-xs font-medium text-gray-600">{role.label}</span>
                  </div>
                  {rows.length > 0 ? (
                    <div className="space-y-2 pl-2">
                      {rows.map(({ materialId, quantity }, i) => {
                        const m = materialMap.get(materialId);
                        if (!m) return null;
                        return (
                          <ReadonlyMaterialRow key={`${materialId}-${i}`}
                            materialNumber={m.material_number} name={m.name} color={m.color}
                            setPriceJpy={Number(m.set_price_jpy)} unitType={m.unit_type} quantity={quantity} />
                        );
                      })}
                    </div>
                  ) : <p className="text-xs text-gray-300 pl-2 italic">—</p>}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">Non-main materials &amp; 用尺 are set on the Model version — edit them via the <span className="font-medium">Model Recipe</span> card above.</p>
        </div>

        {/* Total material (base) */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <div className="flex-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Material Cost <span className="font-normal text-gray-400">— base</span></div>
          <div className="w-24 shrink-0" /><div className="w-8 shrink-0" />
          <div className="w-24 text-right font-mono font-semibold text-gray-900 shrink-0">¥{fmt(baseMaterialCost)}</div>
        </div>
      </SectionBlock>

      {/* ── Manufacturing Costs ── */}
      <SectionBlock title="Manufacturing Costs">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-400">
            {productCategory ? `Category: ${productCategory}` : "No category set"}
          </p>
          {autofillCat
            ? <button type="button" onClick={handleAutofill}
                className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded border border-gray-200">
                Autofill for {productCategory}
              </button>
            : <span className="text-xs text-gray-300 italic">No preset for this category</span>
          }
        </div>
        <div className="grid grid-cols-1 gap-y-2.5">
          {MFG_KEYS.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20 shrink-0">{MANUFACTURING_COST_LABELS[key]}</label>
              <MfgInput mfgKey={key} value={mfg[key]} laborRate={laborRate} presets={presets}
                onChange={(v) => setMfg((prev) => ({ ...prev, [key]: v }))} />
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between items-baseline text-xs">
          <span className="text-gray-400">Total Manufacturing <span className="text-gray-300">· ¥{fmt(laborRate)}/hr</span></span>
          <span className="font-mono text-gray-600">
            {mfgHoursTotal.toFixed(1)} hr <span className="text-gray-300">·</span> ¥{fmt(mfgCost)}
          </span>
        </div>
      </SectionBlock>
      </div>
      </fieldset>
      </CollapsibleCard>

      {/* ══ Cost Summary — per colour (its own established section) ══ */}
      <CollapsibleCard title="Cost Summary — per colour" accent subtitle="pricing Orders adopt">
      <fieldset disabled={locked} className="border-0 p-0 m-0 min-w-0 disabled:opacity-70">
        <div className="bg-gray-50 rounded-lg p-4 text-xs">
          {/* Shared base + EUR rate */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1.5 items-center font-sans mb-3">
            <span className="text-gray-500">Total Raw Cost (JPY) — base</span>
            <span className="text-right col-span-1">=</span>
            <span className="text-gray-800 font-semibold text-right font-mono">¥ {fmt(baseCostJpy)}</span>

            <span className="text-gray-400">÷ EUR Rate</span>
            <input type="number" min="0" step={1} value={eurRate || ""} onChange={(e) => setEurRate(Number(e.target.value))}
              className="w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white justify-self-end" />
            <span className="text-gray-400 text-right">JPY / EUR</span>

            <span className="text-gray-400">Client discount <span className="text-gray-300">(fixed)</span></span>
            <span className="text-right">=</span>
            <span className="text-gray-800 font-semibold text-right font-mono">−{clientDiscountPct}%</span>
          </div>

          {colors.length === 0 ? (
            <p className="border-t border-gray-200 pt-3 text-gray-400 font-sans">
              No colours enabled — select which colours this product offers in <span className="font-medium">Basic Info</span>.
            </p>
          ) : (
            <div className="border-t border-gray-200 pt-3 overflow-x-auto">
              <table className="w-full text-xs font-mono whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] text-gray-400 font-sans uppercase tracking-wide text-right">
                    <th className="text-left font-medium pb-1.5 pr-3">Colour</th>
                    <th className="font-medium pb-1.5 px-2">Raw Cost ¥</th>
                    <th className="font-medium pb-1.5 px-2">Cost €</th>
                    <th className="font-medium pb-1.5 px-2">× Markup</th>
                    <th className="font-medium pb-1.5 px-2">Ideal WS €</th>
                    <th className="font-medium pb-1.5 px-2">Retail (ref) €<span className="normal-case text-gray-300"> ÷{(1 / retailMultiplier).toFixed(2)}</span></th>
                    <th className="font-medium pb-1.5 pl-2">Retail Price €</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {colors.map((c, i) => {
                    const e = colorEdits[i] ?? { markup: 3.0, retailRate: 3.5, retailPrice: 0 };
                    const calc = colorCalc(i);
                    return (
                      <tr key={c.productColorId} className="text-right">
                        <td className="text-left py-1.5 pr-3 font-sans font-medium text-gray-800">{c.color}</td>
                        <td className="px-2 text-gray-500">¥{fmt(calc.costJpy)}</td>
                        <td className="px-2 text-gray-500">€{fmtEur(calc.costEur)}</td>
                        <td className="px-2">
                          <div className="inline-flex items-center gap-0.5">
                            <button type="button" tabIndex={-1} onClick={() => setColorField(i, "markup", Math.max(0, Math.round(((e.markup || 0) - 0.1) * 10) / 10))}
                              className="w-5 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 leading-none">−</button>
                            <input type="number" min="0" step={0.1} value={e.markup || ""} onChange={(ev) => setColorField(i, "markup", Number(ev.target.value))}
                              className="w-12 px-1 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white" />
                            <button type="button" tabIndex={-1} onClick={() => setColorField(i, "markup", Math.round(((e.markup || 0) + 0.1) * 10) / 10)}
                              className="w-5 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 leading-none">+</button>
                          </div>
                        </td>
                        <td className="px-2 text-gray-400">€{fmtEur(calc.idealWs)}</td>
                        <td className="px-2 text-gray-400">€{fmtEur(calc.ref)}</td>
                        <td className="pl-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button type="button" onClick={() => setColorField(i, "retailPrice", Number(calc.ref.toFixed(2)))}
                              className="text-[10px] text-blue-600 hover:underline">use ref</button>
                            <input type="number" min="0" step={0.01} value={e.retailPrice || ""} placeholder="0.00"
                              onChange={(ev) => setColorField(i, "retailPrice", Number(ev.target.value))}
                              className="w-20 px-1.5 py-1 border border-gray-400 rounded text-xs text-right font-bold focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 font-sans mt-2">Retail (ref) = Ideal WS ÷ (1 − {clientDiscountPct}%), i.e. clients buy at Ideal WS after a {clientDiscountPct}% discount off retail (captured for this product). Retail Price (EUR) per colour is the price Orders adopt.</p>
            </div>
          )}
        </div>
      </fieldset>
      </CollapsibleCard>
    </div>
  );
}
