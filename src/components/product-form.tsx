"use client";

import { useActionState, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { PRODUCT_CATEGORIES, PRODUCT_SEXES, ACCESSORY_COMPOSITIONS } from "@/lib/product-constants";
import { MaterialPickerModal, type PickableMaterial } from "@/components/material-picker";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;
type SelectOption = { id: string; name: string };

type SelectedMaterial = {
  id: string;
  materialNumber: string | null;
  category: string | null;
  name: string;
  color: string | null;
  comp1Label: string | null; comp1Pct: number | null;
  comp2Label: string | null; comp2Pct: number | null;
  comp3Label: string | null; comp3Pct: number | null;
  comp4Label: string | null; comp4Pct: number | null;
  comp5Label: string | null; comp5Pct: number | null;
};

type InitialData = {
  season_id?: string;
  product_category?: string | null;
  model_name?: string | null;
  product_sex?: string | null;
  is_sample?: boolean;
  is_invalid?: boolean;
  main_material_id?: string | null;
  main_m_category?: string | null;
  main_m_name?: string | null;
  main_m_color?: string | null;
  main_m_comp1_label?: string | null; main_m_comp1_pct?: number | null;
  main_m_comp2_label?: string | null; main_m_comp2_pct?: number | null;
  main_m_comp3_label?: string | null; main_m_comp3_pct?: number | null;
  main_m_comp4_label?: string | null; main_m_comp4_pct?: number | null;
  main_m_comp5_label?: string | null; main_m_comp5_pct?: number | null;
  lining_material_id?: string | null;
  lining_m_category?: string | null;
  lining_m_name?: string | null;
  lining_m_color?: string | null;
  lining_m_comp1_label?: string | null; lining_m_comp1_pct?: number | null;
  lining_m_comp2_label?: string | null; lining_m_comp2_pct?: number | null;
  lining_m_comp3_label?: string | null; lining_m_comp3_pct?: number | null;
  lining_m_comp4_label?: string | null; lining_m_comp4_pct?: number | null;
  lining_m_comp5_label?: string | null; lining_m_comp5_pct?: number | null;
  accessory_composition?: string | null;
  main_material_number?: string | null;
  lining_material_number?: string | null;
};

type Props = {
  action: Action;
  seasons: SelectOption[];
  materials: PickableMaterial[];
  pastModelNames?: string[];
  initialData?: InitialData;
  id?: string;
};

const inputCls  = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";
const selectCls = inputCls + " bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function toSelected(m: PickableMaterial): SelectedMaterial {
  return {
    id: m.id, materialNumber: m.material_number, category: m.category, name: m.name, color: m.color,
    comp1Label: m.comp_1_label, comp1Pct: m.comp_1_pct,
    comp2Label: m.comp_2_label, comp2Pct: m.comp_2_pct,
    comp3Label: m.comp_3_label, comp3Pct: m.comp_3_pct,
    comp4Label: m.comp_4_label, comp4Pct: m.comp_4_pct,
    comp5Label: m.comp_5_label, comp5Pct: m.comp_5_pct,
  };
}

function fromInitial(d: InitialData, prefix: "main" | "lining"): SelectedMaterial | null {
  const id             = prefix === "main" ? d.main_material_id     : d.lining_material_id;
  const name           = prefix === "main" ? d.main_m_name          : d.lining_m_name;
  const materialNumber = prefix === "main" ? d.main_material_number : d.lining_material_number;
  if (!id || !name) return null;
  const get = (k: string) => (d as any)[`${prefix}_m_${k}`] ?? null;
  return {
    id, name, materialNumber: materialNumber ?? null,
    category:   get("category"),
    color:      get("color"),
    comp1Label: get("comp1_label"), comp1Pct: get("comp1_pct"),
    comp2Label: get("comp2_label"), comp2Pct: get("comp2_pct"),
    comp3Label: get("comp3_label"), comp3Pct: get("comp3_pct"),
    comp4Label: get("comp4_label"), comp4Pct: get("comp4_pct"),
    comp5Label: get("comp5_label"), comp5Pct: get("comp5_pct"),
  };
}

function MaterialSummary({ mat, prefix }: { mat: SelectedMaterial; prefix: "main" | "lining" }) {
  const comps = ([1,2,3,4,5] as const)
    .map((n) => [(mat as any)[`comp${n}Label`], (mat as any)[`comp${n}Pct`]] as [string|null, number|null])
    .filter(([l]) => l);
  const p = `${prefix}_m_`;
  return (
    <>
      <input type="hidden" name={`${prefix}_material_id`} value={mat.id} />
      <input type="hidden" name={`${p}category`} value={mat.category ?? ""} />
      <input type="hidden" name={`${p}name`}     value={mat.name} />
      <input type="hidden" name={`${p}color`}    value={mat.color ?? ""} />
      {([1,2,3,4,5] as const).map((n) => (
        <span key={n}>
          <input type="hidden" name={`${p}comp${n}_label`} value={(mat as any)[`comp${n}Label`] ?? ""} />
          <input type="hidden" name={`${p}comp${n}_pct`}   value={(mat as any)[`comp${n}Pct`]   ?? ""} />
        </span>
      ))}
      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs space-y-1.5">
        {mat.materialNumber && (
          <div className="flex gap-3">
            <span className="text-gray-400 w-20 shrink-0">Material ID</span>
            <span className="text-gray-500 font-mono">{mat.materialNumber}</span>
          </div>
        )}
        <div className="flex gap-3">
          <span className="text-gray-400 w-20 shrink-0">Category</span>
          <span className="text-gray-700">{mat.category ?? "—"}</span>
        </div>
        <div className="flex gap-3">
          <span className="text-gray-400 w-20 shrink-0">Name</span>
          <span className="text-gray-900 font-medium">{mat.name}</span>
        </div>
        <div className="flex gap-3">
          <span className="text-gray-400 w-20 shrink-0">Colour</span>
          <span className="text-gray-700">{mat.color ?? "—"}</span>
        </div>
        {comps.length > 0 && (
          <div className="flex gap-3">
            <span className="text-gray-400 w-20 shrink-0">Composition</span>
            <span className="text-gray-700">{comps.map(([l, pct]) => `${l} ${pct}%`).join(" / ")}</span>
          </div>
        )}
      </div>
    </>
  );
}

export function ProductForm({ action, seasons, materials, pastModelNames = [], initialData = {}, id }: Props) {
  const [result, formAction, pending] = useActionState(action, null);
  const formRef     = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mainMat,  setMainMat]  = useState<SelectedMaterial | null>(() => fromInitial(initialData, "main"));
  const [liningMat, setLiningMat] = useState<SelectedMaterial | null>(() => fromInitial(initialData, "lining"));
  const [noLining,  setNoLining]  = useState(!initialData.lining_material_id);
  const [showMain,  setShowMain]  = useState(false);
  const [showLining, setShowLining] = useState(false);

  // flushSync forces React to commit the state update to the DOM synchronously,
  // so requestSubmit() captures the new hidden-input values before any navigation.
  // hasMainAfter: explicit override for whether main material will be set after fn runs.
  function saveAfterStateChange(fn: () => void, hasMainAfter?: boolean) {
    if (!id) { fn(); return; }
    flushSync(fn);
    const canSave = hasMainAfter !== undefined ? hasMainAfter : !!mainMat;
    if (canSave) formRef.current?.requestSubmit();
  }

  function scheduleSubmit(delay: number) {
    if (!id || !mainMat) return;   // suppress auto-save when no main material
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => formRef.current?.requestSubmit(), delay);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLFormElement>) {
    if (!id) return;
    const t = e.target as HTMLElement;
    const isText = t instanceof HTMLInputElement && (t.type === "text" || t.type === "number" || t.type === "");
    scheduleSubmit(isText ? 1000 : 200);
  }

  function selectMain(m: PickableMaterial) {
    saveAfterStateChange(() => setMainMat(toSelected(m)), true);  // will have main after
  }
  function selectLining(m: PickableMaterial) {
    saveAfterStateChange(() => { setLiningMat(toSelected(m)); setNoLining(false); }, !!mainMat);
  }
  function removeLining() {
    saveAfterStateChange(() => { setLiningMat(null); setNoLining(true); }, !!mainMat);
  }

  const isError = result && result !== "ok";

  return (
    <>
      {showMain && (
        <MaterialPickerModal
          materials={materials}
          onSelect={selectMain}
          onClose={() => setShowMain(false)}
        />
      )}
      {showLining && (
        <MaterialPickerModal
          materials={materials}
          onSelect={selectLining}
          onClose={() => setShowLining(false)}
        />
      )}

      <form action={formAction} ref={formRef} onChange={handleFormChange} className="flex flex-col gap-6">
        {id && <input type="hidden" name="id" value={id} />}
        {isError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{result}</p>}

        {/* ── 1. Product Info ── */}
        <Section title="Product Info">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Season <span className="text-red-500">*</span></label>
              <select name="season_id" defaultValue={initialData.season_id ?? ""} required className={selectCls}>
                <option value="">Select...</option>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Product Category <span className="text-red-500">*</span></label>
              <select name="product_category" defaultValue={initialData.product_category ?? ""} required className={selectCls}>
                <option value="">Select...</option>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model Name <span className="text-red-500">*</span></label>
              {pastModelNames.length > 0 && (
                <datalist id="past-model-names">
                  {pastModelNames.map((n) => <option key={n} value={n} />)}
                </datalist>
              )}
              <input
                name="model_name"
                defaultValue={initialData.model_name ?? ""}
                required
                list={pastModelNames.length > 0 ? "past-model-names" : undefined}
                lang="en-GB"
                spellCheck
                className={inputCls}
                placeholder="e.g. Classic Coat"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Product Sex</label>
              <select name="product_sex" defaultValue={initialData.product_sex ?? ""} className={selectCls}>
                <option value="">—</option>
                {PRODUCT_SEXES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
              <input type="hidden" name="is_sample" value="false" />
              <input type="checkbox" defaultChecked={initialData.is_sample ?? false}
                onChange={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement).value = e.currentTarget.checked ? "true" : "false"; }}
                className="w-4 h-4" />
              Is Sample
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none">
              <input type="hidden" name="is_invalid" value="false" />
              <input type="checkbox" defaultChecked={initialData.is_invalid ?? false}
                onChange={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement).value = e.currentTarget.checked ? "true" : "false"; }}
                className="w-4 h-4" />
              Invalid
            </label>
          </div>
        </Section>

        {/* ── 2. Main Material ── */}
        <Section title="Main Material *">
          {mainMat ? (
            <>
              <MaterialSummary mat={mainMat} prefix="main" />
              <button type="button" onClick={() => setShowMain(true)} className="text-xs text-gray-500 hover:text-gray-900 underline w-fit">Change material</button>
            </>
          ) : (
            <>
              <input type="hidden" name="main_material_id" value="" />
              {id && (
                <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠ Main material is required — auto-save is paused until a material is selected.
                </p>
              )}
              <button type="button" onClick={() => setShowMain(true)}
                className="px-4 py-3 border-2 border-dashed border-red-300 rounded-lg text-sm text-red-500 hover:border-red-500 hover:text-red-700 w-fit">
                + Select Main Material
              </button>
            </>
          )}
        </Section>

        {/* ── 3. Lining Material ── */}
        <Section title="Lining Material">
          {noLining && !liningMat ? (
            <div className="flex gap-3 items-center">
              <span className="text-xs text-gray-400 italic">No Lining</span>
              <button type="button" onClick={() => setShowLining(true)} className="text-xs text-gray-500 hover:text-gray-900 underline">+ Add lining</button>
              <input type="hidden" name="lining_material_id" value="" />
            </div>
          ) : liningMat ? (
            <>
              <MaterialSummary mat={liningMat} prefix="lining" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowLining(true)} className="text-xs text-gray-500 hover:text-gray-900 underline">Change</button>
                <button type="button" onClick={removeLining} className="text-xs text-red-400 hover:text-red-600 underline">Remove</button>
              </div>
            </>
          ) : (
            <div className="flex gap-3 items-center">
              <button type="button" onClick={() => setShowLining(true)}
                className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-500 hover:text-gray-700 w-fit">
                + Select Lining Material
              </button>
              <button type="button" onClick={() => saveAfterStateChange(() => setNoLining(true))}
                className="text-xs text-gray-400 hover:text-gray-600 underline">No Lining</button>
              <input type="hidden" name="lining_material_id" value="" />
            </div>
          )}
        </Section>

        {/* ── 4. Accessories Composition ── */}
        <Section title="Accessories Composition">
          <select name="accessory_composition" defaultValue={initialData.accessory_composition ?? ""} className={selectCls}>
            <option value="">— None —</option>
            {ACCESSORY_COMPOSITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Section>

        <div className="pt-1 border-t border-gray-100 flex items-center gap-3">
          {id ? (
            <span className="text-xs text-gray-400">
              {pending ? "Saving..." : result === "ok" ? "✓ Saved" : ""}
            </span>
          ) : (
            <>
              {!mainMat && (
                <span className="text-xs text-red-500">Select a main material to create</span>
              )}
              <button type="submit" disabled={pending || !mainMat}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {pending ? "Saving..." : "Create"}
              </button>
            </>
          )}
        </div>
      </form>
    </>
  );
}
