"use client";

import { useActionState, useState, useRef } from "react";
import { flushSync } from "react-dom";
import { PRODUCT_SEXES } from "@/lib/product-constants";
import { MaterialPickerModal, type PickableMaterial } from "@/components/material-picker";
import { ModelVersionPicker, type ModelSelection } from "@/components/model-version-picker";
import type { PickerModel } from "@/lib/models-picker-data";
import { CollapsibleCard } from "@/components/collapsible-card";
import { addListOption } from "@/app/actions/list-options";

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
  model_id?: string | null;
  model_version_id?: string | null;
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
  lining_material_color_id?: string | null;
  enabled_color_ids?: string[];
  orderable_sizes?: string[] | null;
  tags?: string[];
};

type Props = {
  action: Action;
  seasons: SelectOption[];
  materials: PickableMaterial[];
  models?: PickerModel[];
  pastModelNames?: string[];
  initialData?: InitialData;
  id?: string;
  categoryOptions?: string[];
  sexOptions?: string[];
  accessoryCompositionOptions?: string[];
  tagOptions?: string[];
  locked?: boolean;
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

export function ProductForm({
  action,
  seasons,
  materials,
  models = [],
  initialData = {},
  id,
  sexOptions = [...PRODUCT_SEXES],
  tagOptions = [],
  locked = false,
}: Props) {
  const [result, formAction, pending] = useActionState(action, null);
  const formRef     = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mainMat,  setMainMat]  = useState<SelectedMaterial | null>(() => fromInitial(initialData, "main"));
  const [showMain,  setShowMain]  = useState(false);
  const [enabledColorIds, setEnabledColorIds] = useState<Set<string>>(() => new Set(initialData.enabled_color_ids ?? []));

  // Category is inherited from the Model; sex is Product-owned. Both tracked in state so the
  // hidden inputs stay in sync (orderable sizes are Version-owned now — ADR-0011 §9.7).
  const [category, setCategory] = useState<string>(initialData.product_category ?? "");
  const [sex, setSex] = useState<string>(initialData.product_sex ?? "");

  // ADR-0011 Phase 3b — the product links to a Model + Version (picker below). Season is
  // tracked in state so the picker can default/create versions for the right season; category
  // is inherited from the selected Model (read-only), and model_name is a denormalized copy.
  const [seasonId, setSeasonId] = useState<string>(initialData.season_id ?? "");
  const [modelId, setModelId] = useState<string | null>(initialData.model_id ?? null);
  const [versionId, setVersionId] = useState<string | null>(initialData.model_version_id ?? null);
  const [modelName, setModelName] = useState<string>(initialData.model_name ?? "");
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? null;

  function handleSeasonChange(next: string) {
    setSeasonId(next);
    scheduleSubmit(200);
  }
  function handleModelChange(sel: ModelSelection) {
    setModelId(sel.modelId);
    setVersionId(sel.versionId);
    setModelName(sel.modelName);
    // Category is inherited from the Model — re-apply it (also re-defaults orderable sizes).
    if (sel.category !== category) handleCategoryChange(sel.category);
    else scheduleSubmit(200);
  }
  const [tags, setTags] = useState<Set<string>>(() => new Set(initialData.tags ?? []));
  // Managed tags plus any already on the product that are no longer in the list.
  const [tagChoices, setTagChoices] = useState<string[]>(
    () => Array.from(new Set([...tagOptions, ...(initialData.tags ?? [])]))
  );
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  function toggleTag(t: string) {
    setTags((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; });
    scheduleSubmit(200);
  }
  // Create a brand-new tag right here: persist it to the shared list (Settings)
  // and select it on this product immediately.
  async function addNewTag() {
    const v = newTag.trim();
    if (!v) return;
    if (!tagChoices.includes(v)) {
      setAddingTag(true);
      const err = await addListOption("product_tag", v);
      setAddingTag(false);
      if (err && !/already exists/i.test(err)) { alert(err); return; }
      setTagChoices((prev) => (prev.includes(v) ? prev : [...prev, v]));
    }
    setTags((prev) => new Set(prev).add(v));
    setNewTag("");
    scheduleSubmit(200);
  }
  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory);
    scheduleSubmit(200);
  }
  function handleSexChange(nextSex: string) {
    setSex(nextSex);
    scheduleSubmit(200);
  }

  // The selected main material's colour list (looked up from the materials catalogue)
  const mainColors   = (mainMat   ? materials.find((m) => m.id === mainMat.id)?.colors   : null) ?? [];

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
    // Edit mode auto-saves. (Previously suppressed when no main material, which
    // also blocked editing basic info like Category/Sex on such products.)
    if (!id) return;
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
    // Colours belong to the main material — reset the enabled set when it changes.
    saveAfterStateChange(() => { setMainMat(toSelected(m)); setEnabledColorIds(new Set()); }, true);
  }
  function toggleColor(mcId: string) {
    setEnabledColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(mcId)) next.delete(mcId); else next.add(mcId);
      return next;
    });
    scheduleSubmit(200);
  }

  const isError = result && result !== "ok";

  const formInner = (
      <form action={formAction} ref={formRef} onChange={handleFormChange}>
        <fieldset disabled={locked} className="flex flex-col gap-5 border-0 p-0 m-0 min-w-0 disabled:opacity-70">
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="enabled_color_ids" value={JSON.stringify([...enabledColorIds])} />
        {isError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{result}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5 items-start">
        {/* ══ Left column: identity & sizes ══ */}
        <div className="flex flex-col gap-5">
        {/* ── 1. Product Info ── */}
        <Section title="Product Info">
          {/* Hidden inputs — the Model/Version picker (below) is the source of truth for
              model_id / model_version_id / model_name, and category is inherited from the Model. */}
          <input type="hidden" name="model_id" value={modelId ?? ""} />
          <input type="hidden" name="model_version_id" value={versionId ?? ""} />
          <input type="hidden" name="model_name" value={modelName} />
          <input type="hidden" name="product_category" value={category} />

          {/* Season / Sex in one row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Season <span className="text-red-500">*</span></label>
              <select name="season_id" value={seasonId} required className={selectCls}
                onChange={(e) => handleSeasonChange(e.target.value)}>
                <option value="">Select...</option>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sex</label>
              <select name="product_sex" value={sex} className={selectCls}
                onChange={(e) => handleSexChange(e.target.value)}>
                <option value="">—</option>
                {sex && !sexOptions.includes(sex) && <option value={sex}>{sex}</option>}
                {sexOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <ModelVersionPicker
            models={models}
            seasonId={seasonId}
            seasonName={seasonName}
            value={{ modelId, versionId }}
            fallbackName={initialData.model_name ?? null}
            fallbackCategory={initialData.product_category ?? null}
            onChange={handleModelChange}
            productId={id}
            disabled={locked}
          />
          {!seasonId && (
            <p className="text-[11px] text-amber-600">Select a Season first — new versions are created for it.</p>
          )}

          {/* Tags — pick existing, or type a new one and Add (also saved to Settings) */}
          <div>
            <input type="hidden" name="tags" value={JSON.stringify([...tags])} />
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            {tagChoices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagChoices.map((t) => {
                  const on = tags.has(t);
                  return (
                    <button key={t} type="button" onClick={() => toggleTag(t)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewTag(); } }}
                placeholder="New tag…"
                className="w-40 px-2.5 py-1 border border-gray-300 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <button type="button" onClick={addNewTag} disabled={addingTag || !newTag.trim()}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-40">
                {addingTag ? "…" : "+ Add"}
              </button>
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

        {/* Lining, Orderable Sizes and Accessories Composition are Version-owned — see the read-only
            "Model Recipe" card below (ADR-0011 §9.7). Edit them via the Model version editor. */}
        </div>

        {/* ══ Right column: materials ══ */}
        <div className="flex flex-col gap-5">
        {/* ── 2. Main Material ── */}
        <Section title="Main Material *">
          {mainMat ? (
            <>
              <MaterialSummary mat={mainMat} prefix="main" />
              <button type="button" onClick={() => setShowMain(true)} className="text-xs text-gray-500 hover:text-gray-900 underline w-fit">Change material</button>

              <div className={`mt-2 rounded-lg border p-3 ${mainColors.length > 0 && enabledColorIds.size === 0 ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50/60"}`}>
                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${enabledColorIds.size > 0 ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>
                    {enabledColorIds.size > 0 ? "✓" : "!"}
                  </span>
                  Select orderable colours <span className="text-red-500">*</span>
                </p>
                {mainColors.length === 0 ? (
                  <p className="text-[11px] text-gray-400">This material has no colours — add colours on the material first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {mainColors.map((c) => {
                      const on = enabledColorIds.has(c.id);
                      return (
                        <label key={c.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer select-none transition-colors ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-900"}`}>
                          <input type="checkbox" checked={on} onChange={() => toggleColor(c.id)} className="sr-only" />
                          <span className={`inline-block w-3 h-3 rounded-full border ${on ? "bg-white border-white" : "border-gray-400"}`} />
                          {c.color}
                        </label>
                      );
                    })}
                  </div>
                )}
                {mainColors.length > 0 && enabledColorIds.size === 0 && (
                  <p className="text-[11px] text-amber-700 font-medium mt-2">⚠ Pick at least one colour so this product can be ordered.</p>
                )}
                {mainColors.length > 0 && enabledColorIds.size > 0 && (
                  <p className="text-[11px] text-gray-400 mt-2">{enabledColorIds.size} of {mainColors.length} colour(s) selected.</p>
                )}
              </div>
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

        {/* Lining & Accessories Composition are Version-owned (read-only "Model Recipe" card below). */}
        </div>
        </div>

        <div className="pt-1 border-t border-gray-100 flex items-center gap-3">
          {id ? (
            <span className="text-xs text-gray-400">
              {pending ? "Saving..." : result === "ok" ? "✓ Saved" : ""}
            </span>
          ) : (
            <>
              {(!mainMat || !modelId) && (
                <span className="text-xs text-red-500">
                  {!modelId ? "Select a Model to create" : "Select a main material to create"}
                </span>
              )}
              <button type="submit" disabled={pending || !mainMat || !modelId}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {pending ? "Saving..." : "Create"}
              </button>
            </>
          )}
        </div>
        </fieldset>
      </form>
  );

  return (
    <>
      {showMain && (
        <MaterialPickerModal
          materials={materials}
          onSelect={selectMain}
          onClose={() => setShowMain(false)}
        />
      )}
      {id ? (
        <CollapsibleCard
          title="Basic Info"
          right={locked
            ? <span className="text-xs font-medium text-amber-600">🔒 Locked</span>
            : <span className="text-xs text-gray-400">{pending ? "Saving…" : result === "ok" ? "✓ Saved" : ""}</span>}
        >
          {formInner}
        </CollapsibleCard>
      ) : (
        formInner
      )}
    </>
  );
}
