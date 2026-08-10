"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getModelVersionEditData, updateModelVersion, deleteModelVersion } from "@/app/actions/models";
import { MaterialPickerModal, type PickableMaterial } from "@/components/material-picker";
import {
  MODEL_VERSION_MATERIAL_ROLES,
  MODEL_VERSION_MATERIAL_ROLE_LABELS,
  MODEL_VERSION_STATUS_LABELS,
  type ModelVersionStatus,
} from "@/lib/model-constants";
import { ACCESSORY_COMPOSITIONS, ORDERABLE_SIZE_PRESETS, defaultOrderableSizes } from "@/lib/product-constants";
import { SIZES } from "@/lib/order-constants";
import {
  MANUFACTURING_COST_LABELS,
  MANUFACTURING_HOUR_PRESETS,
  formatHours,
  type ManufacturingCostKey,
  type ManufacturingCategory,
} from "@/lib/presets";
import { calcMfgAmountFromHours } from "@/lib/pricing";

export type VersionEditData = {
  modelName: string;
  category: string;
  versionId: string;
  season: string;
  status: string;
  changelog: string;
  orderableSizes: string[];
  accessoryComposition: string;
  minutes: { cutting: number; sewing: number; knitting: number; thread: number; finish: number; packing: number };
  materials: { role: string; material_id: string; material_color_id: string | null; usage_amount: number }[];
  productCount: number;
};
export type ModelVersionEditBundle = { data: VersionEditData; materials: PickableMaterial[]; laborRate: number };

type Row = { key: string; role: string; material_id: string; material_color_id: string | null; usage_amount: number };

let ROW_SEQ = 0;
const newRowKey = () => `r${ROW_SEQ++}`;
const MFG_KEYS: ManufacturingCostKey[] = ["cutting", "sewing", "knitting", "thread", "finish", "packing"];
const fmt = (n: number) => n.toLocaleString();
const inputCls = "px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400";

// Self-contained popup: fetches the version bundle on open, renders the editor.
export function ModelVersionEditModal({
  versionId,
  onClose,
  onDone,
}: {
  versionId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [bundle, setBundle] = useState<ModelVersionEditBundle | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    getModelVersionEditData(versionId).then((b) => {
      if (!alive) return;
      if (b) setBundle(b as ModelVersionEditBundle);
      else setMissing(true);
    });
    return () => { alive = false; };
  }, [versionId]);

  const statusLabel = bundle
    ? MODEL_VERSION_STATUS_LABELS[bundle.data.status as ModelVersionStatus] ?? bundle.data.status
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {bundle ? `${bundle.data.modelName} · ${bundle.data.season} version` : "Version"}
            {bundle && <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{statusLabel}</span>}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 text-sm shrink-0">Close ✕</button>
        </div>
        <div className="p-4 sm:p-5">
          {missing ? (
            <p className="text-sm text-gray-500 py-8 text-center">Version not found.</p>
          ) : !bundle ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
          ) : (
            <VersionEditorBody bundle={bundle} onClose={onClose} onDone={onDone} />
          )}
        </div>
      </div>
    </div>
  );
}

function VersionEditorBody({ bundle, onClose, onDone }: { bundle: ModelVersionEditBundle; onClose: () => void; onDone: () => void }) {
  const { data, materials, laborRate } = bundle;
  const readOnly = data.status !== "active";
  const matById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const [rows, setRows] = useState<Row[]>(() => data.materials.map((m) => ({ key: newRowKey(), ...m })));
  const [sizes, setSizes] = useState<Set<string>>(() => new Set(data.orderableSizes));
  const [accessory, setAccessory] = useState(data.accessoryComposition);
  const [hours, setHours] = useState(() => ({
    cutting: data.minutes.cutting / 60,
    sewing: data.minutes.sewing / 60,
    knitting: data.minutes.knitting / 60,
    thread: data.minutes.thread / 60,
    finish: data.minutes.finish / 60,
    packing: data.minutes.packing / 60,
  }));
  const [changelog, setChangelog] = useState(data.changelog);
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = () =>
    setRows((rs) => [...rs, { key: newRowKey(), role: "lining", material_id: "", material_color_id: null, usage_amount: 0 }]);
  const pickMaterial = (m: PickableMaterial) => {
    if (pickingKey) updateRow(pickingKey, { material_id: m.id, material_color_id: null });
  };
  const toggleSize = (s: string) =>
    setSizes((p) => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  const catPreset = (k: ManufacturingCostKey) =>
    MANUFACTURING_HOUR_PRESETS[k][data.category as ManufacturingCategory] ?? 0;

  const totalHours = MFG_KEYS.reduce((s, k) => s + (hours[k] || 0), 0);
  const totalYen = MFG_KEYS.reduce((s, k) => s + calcMfgAmountFromHours(hours[k] || 0, laborRate), 0);

  const save = () => {
    if (rows.some((r) => !r.material_id)) { alert("Select a material for every row (or remove empty rows)."); return; }
    start(async () => {
      const err = await updateModelVersion(data.versionId, {
        changelog: changelog.trim() || null,
        orderable_sizes: SIZES.filter((s) => sizes.has(s)),
        accessory_composition: accessory.trim() || null,
        minutes: {
          cutting: hours.cutting * 60,
          sewing: hours.sewing * 60,
          knitting: hours.knitting * 60,
          thread: hours.thread * 60,
          finish: hours.finish * 60,
          packing: hours.packing * 60,
        },
        materials: rows.map((r) => ({
          role: r.role,
          material_id: r.material_id,
          material_color_id: r.material_color_id,
          usage_amount: r.usage_amount,
        })),
      });
      if (err) alert(err);
      else onDone();
    });
  };

  const del = () => {
    if (data.productCount > 0) {
      alert(`This version is used by ${data.productCount} product(s) and can't be deleted.`);
      return;
    }
    if (!confirm(`Delete this ${data.season} version? This can't be undone.`)) return;
    startDelete(async () => {
      const err = await deleteModelVersion(data.versionId);
      if (err) alert(err);
      else onDone();
    });
  };

  return (
    <div className="space-y-5">
      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          This version is read-only. To change the recipe, create a new version (copy-forward) from the model page.
        </div>
      )}

      {/* ── Non-main materials ── */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Non-main materials &amp; 用尺</h3>
        <p className="text-[11px] text-gray-400 mb-3">Shared recipe (lining, interfacing, accessories…). The main material stays on each Product.</p>
        <div className="space-y-2">
          {rows.map((row) => {
            const mat = matById.get(row.material_id);
            const colors = mat?.colors ?? [];
            return (
              <div key={row.key} className="flex flex-wrap items-center gap-2">
                <select value={row.role} disabled={readOnly} onChange={(e) => updateRow(row.key, { role: e.target.value })} className={inputCls + " w-36"}>
                  {MODEL_VERSION_MATERIAL_ROLES.map((r) => (
                    <option key={r} value={r}>{MODEL_VERSION_MATERIAL_ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button type="button" disabled={readOnly} onClick={() => setPickingKey(row.key)}
                  className="flex-1 min-w-48 text-left px-2 py-1.5 border border-gray-300 rounded text-sm hover:border-gray-500 disabled:bg-gray-50 disabled:hover:border-gray-300">
                  {mat ? (
                    <span className="text-gray-900">{mat.name}{mat.material_number && <span className="ml-1.5 text-gray-400 font-mono text-xs">{mat.material_number}</span>}</span>
                  ) : (
                    <span className="text-gray-400">Select material…</span>
                  )}
                </button>
                <select value={row.material_color_id ?? ""} disabled={readOnly || !colors.length}
                  onChange={(e) => updateRow(row.key, { material_color_id: e.target.value || null })} className={inputCls + " w-32"}>
                  <option value="">{colors.length ? "(no colour)" : "—"}</option>
                  {colors.map((c) => (<option key={c.id} value={c.id}>{c.color}</option>))}
                </select>
                <input type="number" step="0.01" min="0" value={row.usage_amount} disabled={readOnly}
                  onChange={(e) => updateRow(row.key, { usage_amount: Number(e.target.value) })} className={inputCls + " w-24 text-right"} />
                <span className="text-xs text-gray-400 w-12">{mat?.unit_type ?? ""}</span>
                {!readOnly && (
                  <button type="button" onClick={() => removeRow(row.key)} className="text-gray-400 hover:text-red-600 px-1" aria-label="Remove row">✕</button>
                )}
              </div>
            );
          })}
          {!rows.length && <p className="text-xs text-gray-300">No non-main materials.</p>}
        </div>
        {!readOnly && (
          <button type="button" onClick={addRow} className="mt-3 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">+ Add material</button>
        )}
      </section>

      {/* ── Orderable sizes ── */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Orderable sizes</h3>
        {!readOnly && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ORDERABLE_SIZE_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => setSizes(new Set(p.sizes))}
                className="px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-600 hover:border-gray-900 hover:text-gray-900">{p.label}</button>
            ))}
            <button type="button" onClick={() => setSizes(new Set(defaultOrderableSizes(data.category)))}
              className="px-2.5 py-1 rounded-full border border-gray-300 text-xs text-gray-600 hover:border-gray-900 hover:text-gray-900">Default ({data.category})</button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {SIZES.map((s) => {
            const on = sizes.has(s);
            return (
              <button key={s} type="button" onClick={() => { if (!readOnly) toggleSize(s); }}
                className={`min-w-[2.25rem] px-2 py-1 rounded border text-xs ${readOnly ? "cursor-default" : ""} ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-300"}`}>{s}</button>
            );
          })}
        </div>
      </section>

      {/* ── Accessory composition ── */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Accessory composition</h3>
        <select value={accessory} disabled={readOnly} onChange={(e) => setAccessory(e.target.value)} className={inputCls + " w-full max-w-md"}>
          <option value="">None</option>
          {ACCESSORY_COMPOSITIONS.map((a) => (<option key={a} value={a}>{a}</option>))}
          {accessory && !(ACCESSORY_COMPOSITIONS as readonly string[]).includes(accessory) && <option value={accessory}>{accessory}</option>}
        </select>
      </section>

      {/* ── Manufacturing template ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Manufacturing template <span className="text-gray-400">(hours × ¥{fmt(laborRate)}/h)</span></h3>
          {!readOnly && (
            <button type="button" onClick={() => setHours({ cutting: catPreset("cutting"), sewing: catPreset("sewing"), knitting: catPreset("knitting"), thread: catPreset("thread"), finish: catPreset("finish"), packing: catPreset("packing") })}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Apply {data.category} presets</button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MFG_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-16 shrink-0">{MANUFACTURING_COST_LABELS[k]}</label>
              <input type="number" step="0.25" min="0" value={hours[k]} disabled={readOnly}
                onChange={(e) => setHours((h) => ({ ...h, [k]: Number(e.target.value) }))} className={inputCls + " w-16 text-right"} />
              <span className="text-[11px] text-gray-400">h</span>
              <span className="text-[11px] font-mono text-gray-500 w-16 text-right">¥{fmt(calcMfgAmountFromHours(hours[k] || 0, laborRate))}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Total: {formatHours(totalHours)}h · ¥{fmt(totalYen)}</p>
      </section>

      {/* ── Changelog ── */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-1">Changelog</h3>
        <textarea value={changelog} disabled={readOnly} onChange={(e) => setChangelog(e.target.value)} rows={2}
          className={inputCls + " w-full"} placeholder="What changed from the previous version" />
      </section>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 -mx-1 px-1">
        <button type="button" onClick={del} disabled={deleting}
          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 pt-3" title={data.productCount > 0 ? `Used by ${data.productCount} product(s)` : undefined}>
          {deleting ? "Deleting…" : "Delete version"}
        </button>
        <div className="flex gap-2 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          {!readOnly && (
            <button type="button" onClick={save} disabled={pending}
              className="px-5 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
              {pending ? "Saving..." : "Save version"}
            </button>
          )}
        </div>
      </div>

      {pickingKey && <MaterialPickerModal materials={materials} onSelect={pickMaterial} onClose={() => setPickingKey(null)} />}
    </div>
  );
}
