"use client";

import { useState, useRef, useEffect } from "react";
import { CLEANING_INSTRUCTIONS, suggestHSCode } from "@/lib/product-constants";
import { saveProductCare } from "@/app/actions/products";

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
const selectCls = inputCls + " bg-white";

type Props = {
  productId: string;
  initialCleaningInstruction: string | null;
  initialWeightG: number | null;
  initialHsCode: string | null;
  productCategory: string | null;
  productSex: string | null;
  mainComp1Label: string | null;
};

export function ProductCareForm({
  productId,
  initialCleaningInstruction,
  initialWeightG,
  initialHsCode,
  productCategory,
  productSex,
  mainComp1Label,
}: Props) {
  const [cleaning, setCleaning] = useState(initialCleaningInstruction ?? "");
  const [weightG,  setWeightG]  = useState<number | "">(initialWeightG ?? "");
  const [hsCode,   setHsCode]   = useState(initialHsCode ?? "");
  const [hsAuto,   setHsAuto]   = useState(!initialHsCode);

  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError,  setSaveError]  = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef     = useRef({ cleaning, weightG, hsCode });
  latestRef.current   = { cleaning, weightG, hsCode };

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(async () => {
      const v = latestRef.current;
      setSaveStatus("saving");
      setSaveError(null);
      const result = await saveProductCare(
        productId,
        v.cleaning || null,
        v.weightG === "" ? null : Number(v.weightG),
        v.hsCode || null,
      );
      if (result) { setSaveStatus("error"); setSaveError(result); }
      else { setSaveStatus("saved"); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleaning, weightG, hsCode]);

  function autoFill() {
    const suggested = suggestHSCode(productCategory, productSex, mainComp1Label);
    setHsCode(suggested);
    setHsAuto(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Save status */}
      <div className="flex justify-end h-5">
        {saveStatus === "saving" && <span className="text-xs text-gray-400">Saving…</span>}
        {saveStatus === "saved"  && <span className="text-xs text-green-600">✓ Saved</span>}
        {saveStatus === "error"  && <span className="text-xs text-red-500">{saveError ?? "Save failed"}</span>}
      </div>

      {/* Cleaning instruction reference chart */}
      <details className="border border-gray-200 rounded-lg overflow-hidden">
        <summary className="px-4 py-2.5 text-xs font-medium text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
          Cleaning Instruction Guide ▾
        </summary>
        <div className="border-t border-gray-100 p-3 bg-gray-50">
          <img
            src="/cleaning-instruction-guide.png"
            alt="Cleaning instruction reference chart"
            className="w-full max-w-2xl mx-auto block"
          />
        </div>
      </details>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cleaning Instruction</label>
          <select value={cleaning} onChange={(e) => setCleaning(e.target.value)} className={selectCls}>
            <option value="">—</option>
            {CLEANING_INSTRUCTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Weight (g)</label>
          <input
            type="number" min="0" step="1" placeholder="e.g. 850"
            value={weightG}
            onChange={(e) => setWeightG(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">HS Code</label>
        <div className="flex gap-2">
          <input
            type="text" placeholder="e.g. 6201.11"
            value={hsCode}
            onChange={(e) => { setHsCode(e.target.value); setHsAuto(false); }}
            className={inputCls}
          />
          <button
            type="button" onClick={autoFill}
            className="shrink-0 px-3 py-2 border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 whitespace-nowrap"
          >
            Auto-fill
          </button>
        </div>
        {hsAuto && hsCode && (
          <p className="text-xs text-gray-400 mt-1">Auto-suggested — edit to override</p>
        )}
        {productCategory && (
          <p className="text-xs text-gray-400 mt-1">
            Based on: {productCategory}{productSex ? ` / ${productSex}` : ""}{mainComp1Label ? ` / ${mainComp1Label}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
