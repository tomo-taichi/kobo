"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateModel, setModelTags, createModelVersionCopyForward } from "@/app/actions/models";
import { ModelVersionEditModal } from "@/components/model-version-editor";
import { VersionsTable } from "@/components/versions-table";
import { MODEL_CATEGORIES } from "@/lib/model-constants";
import type { VersionRow } from "@/lib/version-rows";

export type { VersionRow };

export type ModelDetailData = {
  id: string;
  name: string;
  category: string;
  archived: boolean;
  tags: string[];
  versions: VersionRow[];
};

export function ModelDetail({ data, tagOptions, seasons }: { data: ModelDetailData; tagOptions: string[]; seasons: { id: string; name: string }[] }) {
  return (
    <div className="space-y-6">
      <Link href="/models" className="text-sm text-gray-500 hover:text-gray-900">← Models</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{data.name}</h1>
        <span className="text-sm text-gray-400">{data.category}</span>
        {data.archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ModelSettings id={data.id} name={data.name} category={data.category} />
        <DefaultTags modelId={data.id} initial={data.tags} options={tagOptions} />
      </div>

      <VersionHistory modelId={data.id} versions={data.versions} seasons={seasons} />
    </div>
  );
}

function ModelSettings({ id, name, category }: { id: string; name: string; category: string }) {
  const [error, formAction, pending] = useActionState(updateModel, null);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-3">Model settings</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model Name *</label>
          <input name="name" defaultValue={name} required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select name="category" defaultValue={category} required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            {MODEL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-gray-400">Identity is (name, category). Sex is set per Product.</p>
        <button type="submit" disabled={pending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 w-fit">
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}

function DefaultTags({ modelId, initial, options }: { modelId: string; initial: string[]; options: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [pending, start] = useTransition();

  // The shared product_tag vocabulary + any tags already on this model (defensive:
  // a value could pre-date the current vocabulary).
  const all = Array.from(new Set([...options, ...initial]));
  const dirty =
    selected.size !== initial.length || initial.some((t) => !selected.has(t));

  const toggle = (t: string) =>
    setSelected((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const save = () =>
    start(async () => {
      const err = await setModelTags(modelId, [...selected]);
      if (err) alert(err);
      else router.refresh();
    });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-700 mb-1">Default tags</h2>
      <p className="text-[11px] text-gray-400 mb-3">Same tag list as Products (managed in Settings). Seeded into a Product&apos;s tags when it is created from this model; existing products are unaffected.</p>
      <div className="flex flex-wrap gap-1.5 mb-3 min-h-[1.5rem]">
        {all.map((t) => {
          const on = selected.has(t);
          return (
            <button key={t} type="button" onClick={() => toggle(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${on ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}>
              {t}
            </button>
          );
        })}
        {!all.length && <span className="text-xs text-gray-300">No tags — add in Settings</span>}
      </div>
      <button type="button" onClick={save} disabled={pending || !dirty}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 w-fit">
        {pending ? "Saving..." : "Save tags"}
      </button>
    </div>
  );
}

function VersionHistory({ modelId, versions, seasons }: { modelId: string; versions: VersionRow[]; seasons: { id: string; name: string }[] }) {
  const router = useRouter();
  const [showCopy, setShowCopy] = useState(false);
  const [editVer, setEditVer] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-700">Versions <span className="text-gray-400">({versions.length})</span></h2>
        <button type="button" onClick={() => setShowCopy(true)}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">New version (copy-forward)</button>
      </div>
      <VersionsTable versions={versions} onOpen={setEditVer} />
      {showCopy && (
        <CopyForwardModal
          modelId={modelId}
          versions={versions}
          seasons={seasons}
          onClose={() => setShowCopy(false)}
          onCreated={(id) => { setShowCopy(false); router.refresh(); setEditVer(id); }}
        />
      )}
      {editVer && (
        <ModelVersionEditModal
          key={editVer}
          versionId={editVer}
          versionIds={versions.map((v) => v.id)}
          onClose={() => setEditVer(null)}
          onDone={() => { setEditVer(null); router.refresh(); }}
          onDuplicated={(newId) => { router.refresh(); setEditVer(newId); }}
        />
      )}
    </div>
  );
}

function CopyForwardModal({
  modelId,
  versions,
  seasons,
  onClose,
  onCreated,
}: {
  modelId: string;
  versions: VersionRow[];
  seasons: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (versionId: string) => void;
}) {
  // Default source = the latest version (list is sorted ascending by season).
  const [sourceId, setSourceId] = useState(versions.length ? versions[versions.length - 1].id : "");
  const [seasonId, setSeasonId] = useState("");
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const res = await createModelVersionCopyForward(modelId, seasonId, sourceId);
      if ("error" in res) alert(res.error);
      else onCreated(res.versionId); // opens the new version's edit popup
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New version (copy-forward)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Copy recipe from</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {versions.map((v) => (
                <option key={v.id} value={v.id}>{v.season} · {v.status}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target season *</label>
            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Select season…</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-gray-400">Creates a new <b>Active</b> version for the target season with the selected version&apos;s recipe. One active version per season — the season must not already have one.</p>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={create} disabled={pending || !sourceId || !seasonId}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50">
              {pending ? "Creating..." : "Create version"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
