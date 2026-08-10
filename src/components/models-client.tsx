"use client";

import { useState, useMemo, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { bulkArchiveModels, bulkDeleteModels, createModel } from "@/app/actions/models";
import { BulkBar } from "@/components/bulk-bar";
import { MODEL_CATEGORIES } from "@/lib/model-constants";

export type ModelRow = {
  id: string;
  name: string;
  category: string;
  archived: boolean;
  version_count: number;
  product_count: number;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ModelsClient({ models }: { models: ModelRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pending, startBulk] = useTransition();

  const archivedCount = models.filter((m) => m.archived).length;
  const shown = useMemo(() => {
    let list = showArchived ? models : models.filter((m) => !m.archived);
    if (category) list = list.filter((m) => m.category === category);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
    return list;
  }, [models, showArchived, category, search]);

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSel = shown.length > 0 && shown.every((m) => selected.has(m.id));

  const runBulk = (fn: () => Promise<string | null>) =>
    startBulk(async () => {
      const msg = await fn();
      setSelected(new Set());
      router.refresh();
      if (msg) alert(msg);
    });

  const td = "px-4 py-2.5";
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search model name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <option value="">All Categories</option>
          {MODEL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{shown.length} of {models.length}</span>
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
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Versions</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Products</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((m) => {
              const isSel = selected.has(m.id);
              return (
                <tr key={m.id} onClick={() => router.push(`/models/${m.id}/edit`)}
                  className={`cursor-pointer hover:bg-gray-50 ${isSel ? "bg-gray-50" : ""} ${m.archived ? "opacity-50" : ""}`}>
                  <td className={td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={isSel} onChange={() => toggle(m.id)} aria-label={`Select ${m.name}`} className="align-middle accent-gray-900" />
                  </td>
                  <td className={`${td} text-gray-900`}>
                    {m.name}
                    {m.archived && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 align-middle">Archived</span>}
                  </td>
                  <td className={`${td} text-gray-500`}>{m.category}</td>
                  <td className={`${td} text-center text-gray-500`}>{m.version_count}</td>
                  <td className={`${td} text-center text-gray-500`}>{m.product_count}</td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">{search || category ? "No models match" : "No models"}</td></tr>
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
        onClear={() => setSelected(new Set())}
      />

      {showNew && <NewModelModal onClose={() => setShowNew(false)} />}
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
