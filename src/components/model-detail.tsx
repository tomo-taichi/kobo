"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateModel, setModelTags } from "@/app/actions/models";
import { MODEL_CATEGORIES, MODEL_VERSION_STATUS_LABELS, type ModelVersionStatus } from "@/lib/model-constants";

export type VersionRow = {
  id: string;
  season: string;
  status: string;
  changelog: string | null;
  sizes_count: number;
  accessory_composition: string | null;
  updated_at: string;
  product_count: number;
  material_count: number;
};

export type ModelDetailData = {
  id: string;
  name: string;
  category: string;
  archived: boolean;
  tags: string[];
  versions: VersionRow[];
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  frozen: "bg-blue-100 text-blue-700",
  deprecated: "bg-amber-100 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  const label = MODEL_VERSION_STATUS_LABELS[status as ModelVersionStatus] ?? status;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

export function ModelDetail({ data, tagOptions }: { data: ModelDetailData; tagOptions: string[] }) {
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

      <VersionHistory versions={data.versions} />
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

function VersionHistory({ versions }: { versions: VersionRow[] }) {
  const td = "px-4 py-2.5";
  return (
    <div>
      <h2 className="text-sm font-medium text-gray-700 mb-2">Versions <span className="text-gray-400">({versions.length})</span></h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Season</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Products</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Materials</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600">Sizes</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Changelog</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {versions.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className={`${td} text-gray-900`}>{v.season}</td>
                <td className={td}><StatusBadge status={v.status} /></td>
                <td className={`${td} text-center text-gray-500`}>{v.product_count}</td>
                <td className={`${td} text-center text-gray-500`}>{v.material_count}</td>
                <td className={`${td} text-center text-gray-500`}>{v.sizes_count}</td>
                <td className={`${td} text-gray-500 max-w-xs truncate`} title={v.changelog ?? ""}>{v.changelog ?? "—"}</td>
              </tr>
            ))}
            {!versions.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No versions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
