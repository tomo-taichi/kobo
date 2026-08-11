"use client";

import { Fragment, useState, useMemo, useTransition, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkArchiveModels, bulkDeleteModels, bulkSetModelTag, createModel, saveModel, mergeModels } from "@/app/actions/models";
import { BulkBar } from "@/components/bulk-bar";
import { ModelVersionEditModal } from "@/components/model-version-editor";
import { VersionsTable } from "@/components/versions-table";
import { MODEL_CATEGORIES } from "@/lib/model-constants";
import { CATEGORY_ICON, catRank } from "@/lib/product-constants";
import type { VersionRow } from "@/lib/version-rows";

export type ModelRow = {
  id: string;
  name: string;
  category: string;
  archived: boolean;
  sexes: string[];
  version_count: number;
  product_count: number;
  tags: string[];
  versions: VersionRow[];
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ModelsClient({ models, tagOptions }: { models: ModelRow[]; tagOptions: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState("Coat"); // default category view
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<ModelRow | null>(null);
  const [editVer, setEditVer] = useState<{ id: string; ids: string[] } | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [pending, startBulk] = useTransition();

  const archivedCount = models.filter((m) => m.archived).length;

  // Everything except the category filter → live per-category counts. Search matches name + tags.
  const preCat = useMemo(() => {
    let list = showArchived ? models : models.filter((m) => !m.archived);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)));
    return list;
  }, [models, showArchived, search]);

  const catCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const m of preCat) acc[m.category] = (acc[m.category] ?? 0) + 1;
    return acc;
  }, [preCat]);
  const categories = useMemo(
    () => Object.keys(catCounts).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b)),
    [catCounts]
  );

  const shown = useMemo(() => (fCat ? preCat.filter((m) => m.category === fCat) : preCat), [preCat, fCat]);

  // Group rows by normalized (case/space-insensitive) name so same-name models cluster
  // and duplicates are easy to spot / merge.
  const groups = useMemo(() => {
    const norm = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
    const map = new Map<string, ModelRow[]>();
    for (const m of shown) { const k = norm(m.name); const a = map.get(k) ?? []; a.push(m); map.set(k, a); }
    return [...map.values()]
      .map((rows) => [...rows].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)))
      .sort((a, b) => a[0].name.toLowerCase().localeCompare(b[0].name.toLowerCase()));
  }, [shown]);

  const seg = (active: boolean) =>
    `px-3 py-1 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSel = shown.length > 0 && shown.every((m) => selected.has(m.id));
  const toggleExpand = (id: string) =>
    setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const runBulk = (fn: () => Promise<string | null>) =>
    startBulk(async () => {
      const msg = await fn();
      setSelected(new Set());
      setTagMenuOpen(false);
      router.refresh();
      if (msg) alert(msg);
    });

  const td = "px-4 py-2.5";
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        {/* Category filter — icon segmented control (matches the Products list) */}
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
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search name or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} className="text-xs text-gray-500 hover:text-gray-900 underline">
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
        >
          New model
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSel}
                  onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((m) => m.id)) : new Set())}
                  className="align-middle accent-gray-900" />
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Sex</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Versions</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Products</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((g) => (
              <Fragment key={`g:${g[0].id}`}>
                {g.length > 1 && (
                  <tr className="bg-amber-50/40">
                    <td></td>
                    <td colSpan={6} className="px-4 py-1.5 text-xs">
                      <span className="font-medium text-gray-700">{g[0].name}</span>
                      <span className="text-gray-400"> · {g.length} models</span>
                      <span className="ml-2 text-amber-700">merge candidates — select &amp; Merge</span>
                    </td>
                  </tr>
                )}
                {g.map((m) => {
              const isSel = selected.has(m.id);
              const isOpen = expanded.has(m.id);
              return (
                <Fragment key={m.id}>
                  <tr onClick={() => setEditing(m)}
                    className={`cursor-pointer hover:bg-gray-50 ${isSel ? "bg-gray-50" : ""} ${m.archived ? "opacity-50" : ""}`}>
                    <td className={td} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => toggle(m.id)} aria-label={`Select ${m.name}`} className="align-middle accent-gray-900" />
                    </td>
                    <td className={`${td} text-gray-400 font-mono text-xs`} title={m.id}>{m.id.slice(0, 8)}</td>
                    <td className={`${td} text-gray-500`}>{m.category}</td>
                    <td className={`${td} text-gray-900`}>
                      <div className="flex items-center gap-1.5">
                        <span>{m.name}</span>
                        {m.archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>}
                      </div>
                      {m.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {m.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 whitespace-nowrap">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`${td} text-gray-500`}>{m.sexes.length ? m.sexes.join(", ") : "—"}</td>
                    <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => toggleExpand(m.id)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        title="Show versions">
                        {m.version_count} <span className="text-[9px]">{isOpen ? "▾" : "▸"}</span>
                      </button>
                    </td>
                    <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                      {m.product_count > 0 ? (
                        <a href={`/products?model=${m.id}`} target="_blank" rel="noopener" title={`${m.product_count} product(s) from this model`}
                          className="inline-flex items-center text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
                          {m.product_count}
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">0</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={7} className="px-4 py-3">
                        <VersionsTable versions={m.versions} onOpen={(vid) => setEditVer({ id: vid, ids: m.versions.map((x) => x.id) })} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
                })}
              </Fragment>
            ))}
            {!shown.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">{search || fCat ? "No models match" : "No models"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <BulkBar
        count={selected.size}
        pending={pending}
        onArchive={() => runBulk(() => bulkArchiveModels([...selected], true))}
        onUnarchive={() => runBulk(() => bulkArchiveModels([...selected], false))}
        onDelete={() => { if (confirm(`Delete ${selected.size} model(s)? Models with versions are kept (archive them instead).`)) runBulk(() => bulkDeleteModels([...selected])); }}
        onClear={() => { setSelected(new Set()); setTagMenuOpen(false); }}
      >
        {selected.size >= 2 && (
          <button type="button" disabled={pending} onClick={() => setMergeOpen(true)}
            className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">Merge…</button>
        )}
        {/* Bulk tag — same managed vocabulary as Products */}
        <div className="relative">
          <button type="button" disabled={pending} onClick={() => setTagMenuOpen((v) => !v)}
            className="px-3 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">Tag ▾</button>
          {tagMenuOpen && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-lg shadow-xl border border-gray-200 py-1 min-w-44 max-h-72 overflow-y-auto">
              {tagOptions.length === 0 && <div className="px-3 py-1.5 text-xs text-gray-400">No tags — add in Settings</div>}
              {tagOptions.map((t) => (
                <div key={t} className="flex items-center justify-between gap-2 px-3 py-1 hover:bg-gray-50 text-xs">
                  <span>{t}</span>
                  <span className="flex gap-1">
                    <button type="button" title="Add to selected" onClick={() => runBulk(() => bulkSetModelTag([...selected], t, true))}
                      className="px-1.5 rounded border border-gray-200 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600">+</button>
                    <button type="button" title="Remove from selected" onClick={() => runBulk(() => bulkSetModelTag([...selected], t, false))}
                      className="px-1.5 rounded border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600">−</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </BulkBar>

      {showNew && <NewModelModal onClose={() => setShowNew(false)} />}
      {editing && (
        <ModelEditModal
          model={editing}
          options={tagOptions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
      {editVer && (
        <ModelVersionEditModal
          key={editVer.id}
          versionId={editVer.id}
          versionIds={editVer.ids}
          onClose={() => setEditVer(null)}
          onDone={() => { setEditVer(null); router.refresh(); }}
          onDuplicated={(newId) => { router.refresh(); setEditVer({ id: newId, ids: [...editVer.ids, newId] }); }}
        />
      )}
      {mergeOpen && (
        <MergeModal
          models={models.filter((m) => selected.has(m.id))}
          onClose={() => setMergeOpen(false)}
          onMerged={() => { setMergeOpen(false); setSelected(new Set()); router.refresh(); }}
        />
      )}
    </div>
  );
}

function MergeModal({ models, onClose, onMerged }: { models: ModelRow[]; onClose: () => void; onMerged: () => void }) {
  const [survivorId, setSurvivorId] = useState(
    () => [...models].sort((a, b) => b.version_count - a.version_count || a.id.localeCompare(b.id))[0]?.id ?? ""
  );
  const [pending, start] = useTransition();
  const categories = Array.from(new Set(models.map((m) => m.category)));
  const survivor = models.find((m) => m.id === survivorId);
  const merge = () =>
    start(async () => {
      const losers = models.map((m) => m.id).filter((id) => id !== survivorId);
      const err = await mergeModels(survivorId, losers);
      if (err) alert(err);
      else onMerged();
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Merge {models.length} models</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Pick the model to keep (survivor). All versions, products, and default tags from the others move to it, then the others are deleted.</p>
        {categories.length > 1 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            These models have different categories ({categories.join(", ")}). The merged model keeps the survivor&apos;s category.
          </p>
        )}
        <div className="flex flex-col gap-1.5 mb-4 max-h-72 overflow-y-auto">
          {models.map((m) => (
            <label key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${survivorId === m.id ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-400"}`}>
              <input type="radio" name="survivor" checked={survivorId === m.id} onChange={() => setSurvivorId(m.id)} className="accent-gray-900" />
              <span className="text-sm text-gray-900 flex-1">{m.name}</span>
              <span className="text-xs text-gray-400">{m.category} · {m.version_count} ver · {m.product_count} prod</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={merge} disabled={pending || !survivorId}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
            {pending ? "Merging…" : `Merge into "${survivor?.name ?? ""}"`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelEditModal({
  model,
  options,
  onClose,
  onSaved,
}: {
  model: ModelRow;
  options: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(model.name);
  const [category, setCategory] = useState(model.category);
  const [tags, setTags] = useState<Set<string>>(new Set(model.tags));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allTags = Array.from(new Set([...options, ...model.tags]));
  const toggleTag = (t: string) =>
    setTags((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const save = () =>
    start(async () => {
      const err = await saveModel(model.id, name, category, [...tags]);
      if (err) setError(err);
      else onSaved();
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Edit model</h2>
          <div className="flex items-center gap-3">
            <Link href={`/models/${model.id}`} className="text-xs text-gray-500 hover:text-gray-900 underline">Open full page →</Link>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {MODEL_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => {
                const on = tags.has(t);
                return (
                  <button key={t} type="button" onClick={() => toggleTag(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}>{t}</button>
                );
              })}
              {!allTags.length && <span className="text-xs text-gray-300">No tags — add in Settings</span>}
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Sex is set per Product. Versions &amp; copy-forward are on the full page.</p>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={save} disabled={pending}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewModelModal({ onClose }: { onClose: () => void }) {
  const [error, formAction, pending] = useActionState(createModel, null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">New model</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        {/* createModel redirects to /models on success (refreshes the list). */}
        <form action={formAction} className="flex flex-col gap-3">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
            <input name="name" required autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select name="category" required defaultValue=""
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Select...</option>
              {MODEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-gray-400">Sex is set per Product, not on the Model. Add versions from the model detail page.</p>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
              {pending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
