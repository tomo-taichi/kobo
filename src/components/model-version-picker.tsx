"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { MODEL_CATEGORIES, MODEL_VERSION_STATUS_LABELS, type ModelVersionStatus } from "@/lib/model-constants";
import { createModelForProduct, createModelVersionCopyForward } from "@/app/actions/models";
import type { PickerModel, PickerVersion } from "@/lib/models-picker-data";

export type ModelSelection = {
  modelId: string;
  versionId: string | null;
  modelName: string;
  category: string;
};

const filterCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs bg-white focus:outline-none focus:ring-1 focus:ring-gray-900";
const selectCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900";

function statusLabel(status: string): string {
  return MODEL_VERSION_STATUS_LABELS[status as ModelVersionStatus] ?? status;
}

// Default version for a model in the product's season (ADR-0011 §5.1): reuse the version
// whose season matches; otherwise the latest non-deprecated version (reuse-until-changed).
function defaultVersionId(m: PickerModel, seasonId: string): string | null {
  const nonDep = m.versions.filter((v) => v.status !== "deprecated");
  const pool = nonDep.length ? nonDep : m.versions;
  const exact = pool.find((v) => v.season_id === seasonId);
  if (exact) return exact.id;
  return pool.length ? pool[pool.length - 1].id : null;
}

export function ModelVersionPicker({
  models,
  seasonId,
  seasonName,
  value,
  fallbackName,
  fallbackCategory,
  onChange,
  disabled = false,
}: {
  models: PickerModel[];
  seasonId: string;
  seasonName?: string | null;
  value: { modelId: string | null; versionId: string | null };
  fallbackName?: string | null;
  fallbackCategory?: string | null;
  onChange: (next: ModelSelection) => void;
  disabled?: boolean;
}) {
  // Local catalogue so models/versions created inline (below) appear without a page reload.
  const [catalog, setCatalog] = useState<PickerModel[]>(models);
  const [showModal, setShowModal] = useState(false);
  const [pending, start] = useTransition();

  const selModel = catalog.find((m) => m.id === value.modelId) ?? null;
  const selVersion = selModel?.versions.find((v) => v.id === value.versionId) ?? null;

  // Version dropdown: non-deprecated versions, plus the current one if it happens to be
  // deprecated (so editing a product still shows its linked version).
  const versionOptions = useMemo<PickerVersion[]>(() => {
    if (!selModel) return [];
    return selModel.versions.filter((v) => v.status !== "deprecated" || v.id === value.versionId);
  }, [selModel, value.versionId]);

  const hasSeasonVersion = !!selModel?.versions.some((v) => v.season_id === seasonId);
  const canCopyForward = !!selModel && !hasSeasonVersion && selModel.versions.length > 0 && !!seasonId;
  // A linked version whose season differs from the product's = reuse of an older recipe.
  const reusingOlder = !!selVersion && selVersion.season_id !== seasonId;

  function emit(model: PickerModel, versionId: string | null) {
    onChange({ modelId: model.id, versionId, modelName: model.name, category: model.category });
  }

  function pickModel(m: PickerModel) {
    setCatalog((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    emit(m, defaultVersionId(m, seasonId));
    setShowModal(false);
  }

  function pickVersion(versionId: string) {
    if (!selModel) return;
    emit(selModel, versionId || null);
  }

  // Copy-forward a new active version for the product's season from the model's latest version.
  function newVersionForSeason() {
    if (!selModel || !seasonId) return;
    const source = selModel.versions[selModel.versions.length - 1];
    if (!source) return;
    start(async () => {
      const res = await createModelVersionCopyForward(selModel.id, seasonId, source.id);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      const version: PickerVersion = { id: res.versionId, season_id: seasonId, season_name: seasonName ?? "—", status: "active" };
      setCatalog((prev) => prev.map((m) => (m.id === selModel.id ? { ...m, versions: [...m.versions, version] } : m)));
      emit({ ...selModel, versions: [...selModel.versions, version] }, res.versionId);
    });
  }

  function onCreated(model: PickerModel, versionId: string | null) {
    setCatalog((prev) => {
      const existing = prev.find((m) => m.id === model.id);
      if (existing) return prev.map((m) => (m.id === model.id ? model : m));
      return [...prev, model];
    });
    emit(model, versionId);
    setShowModal(false);
  }

  const displayName = selModel?.name ?? fallbackName ?? null;
  const displayCategory = selModel?.category ?? fallbackCategory ?? null;

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Model / Version <span className="text-red-500">*</span>
      </label>

      {value.modelId ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
          {/* Selected model */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{displayName ?? "—"}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Category <span className="font-medium text-gray-700">{displayCategory ?? "—"}</span>
                <span className="text-gray-300"> · inherited from Model</span>
              </div>
            </div>
            <button type="button" onClick={() => setShowModal(true)} disabled={disabled}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-900 underline disabled:opacity-50">
              Change model
            </button>
          </div>

          {/* Version */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Version</label>
            <div className="flex items-center gap-2">
              <select
                value={value.versionId ?? ""}
                onChange={(e) => pickVersion(e.target.value)}
                disabled={disabled || versionOptions.length === 0}
                className={selectCls + " flex-1"}
              >
                {versionOptions.length === 0 && <option value="">No versions yet</option>}
                {!value.versionId && versionOptions.length > 0 && <option value="">— Select version —</option>}
                {versionOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.season_name} · {statusLabel(v.status)}
                  </option>
                ))}
              </select>
              {canCopyForward && (
                <button type="button" onClick={newVersionForSeason} disabled={disabled || pending}
                  className="shrink-0 text-xs px-2.5 py-2 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-50 whitespace-nowrap">
                  {pending ? "…" : `+ New version for ${seasonName ?? "season"}`}
                </button>
              )}
            </div>
            {reusingOlder && (
              <p className="text-[11px] text-gray-400 mt-1">
                Reusing the <span className="font-medium">{selVersion?.season_name}</span> version (no separate version for {seasonName ?? "this season"}).
              </p>
            )}
            {!hasSeasonVersion && !canCopyForward && selVersion && (
              <p className="text-[11px] text-gray-400 mt-1">This version covers {seasonName ?? "the product's season"}.</p>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowModal(true)} disabled={disabled}
          className="px-4 py-3 border-2 border-dashed border-red-300 rounded-lg text-sm text-red-500 hover:border-red-500 hover:text-red-700 w-fit disabled:opacity-50">
          + Select Model
        </button>
      )}

      {/* Portalled to <body> so the modal's inputs live OUTSIDE the product <form> — otherwise
          typing/Enter in the search box would bubble into the form's auto-save / submit. */}
      {showModal && typeof document !== "undefined" &&
        createPortal(
          <ModelPickerModal
            models={catalog}
            seasonId={seasonId}
            seasonName={seasonName}
            onPick={pickModel}
            onCreated={onCreated}
            onClose={() => setShowModal(false)}
          />,
          document.body
        )}
    </div>
  );
}

function ModelPickerModal({
  models,
  seasonId,
  seasonName,
  onPick,
  onCreated,
  onClose,
}: {
  models: PickerModel[];
  seasonId: string;
  seasonName?: string | null;
  onPick: (m: PickerModel) => void;
  onCreated: (model: PickerModel, versionId: string | null) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    let list = models;
    if (search.trim()) list = list.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
    if (fCat) list = list.filter((m) => m.category === fCat);
    return list;
  }, [models, search, fCat]);

  function create() {
    setErr(null);
    start(async () => {
      const res = await createModelForProduct(newName, newCat, seasonId);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      const version: PickerVersion | null = res.versionId
        ? { id: res.versionId, season_id: res.seasonId, season_name: res.seasonName ?? "—", status: res.status }
        : null;
      const existing = models.find((m) => m.id === res.modelId);
      const versions = existing
        ? version && !existing.versions.some((v) => v.id === version.id)
          ? [...existing.versions, version]
          : existing.versions
        : version
          ? [version]
          : [];
      onCreated({ id: res.modelId, name: res.modelName, category: res.category, versions }, res.versionId);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Select Model</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* New model */}
        <div className="px-4 py-3 border-b border-gray-100">
          {creating ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  placeholder="New model name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  lang="en-GB"
                  spellCheck
                  className={filterCls}
                />
                <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={filterCls + " w-40"}>
                  <option value="">Category…</option>
                  {MODEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={create} disabled={pending || !newName.trim() || !newCat}
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50">
                  {pending ? "Creating…" : "Create model"}
                </button>
                <button type="button" onClick={() => { setCreating(false); setErr(null); }} className="text-xs text-gray-400 hover:text-gray-700 underline">Cancel</button>
                <span className="text-[11px] text-gray-400">
                  + an empty Active version for {seasonName ?? "this season"}.
                </span>
              </div>
              {err && <p className="text-xs text-red-600">{err}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => { setCreating(true); setNewName(search); }}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900">
              + New model
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-100 grid grid-cols-[1fr_auto_auto] gap-2 items-center">
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={filterCls}
          />
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={filterCls + " w-40"}>
            <option value="">All Categories</option>
            {MODEL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gray-400 whitespace-nowrap px-1">{filtered.length}</span>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Name</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Category</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Versions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((m) => (
                <tr key={m.id} onClick={() => onPick(m)} className="hover:bg-blue-50 cursor-pointer">
                  <td className="px-3 py-2 text-gray-900 font-medium text-xs">{m.name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{m.category}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs text-right">{m.versions.length}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-xs">
                    No models found — use “+ New model” to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
