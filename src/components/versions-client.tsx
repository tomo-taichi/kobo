"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VersionsTable, displayStatus } from "@/components/versions-table";
import { ModelVersionEditModal } from "@/components/model-version-editor";
import { BulkBar } from "@/components/bulk-bar";
import { bulkArchiveModelVersions, bulkDeleteModelVersions } from "@/app/actions/models";
import { CATEGORY_ICON, catRank } from "@/lib/product-constants";
import type { VersionRow } from "@/lib/version-rows";

export type VersionGroup = { modelId: string; modelName: string; modelCategory: string; versions: VersionRow[] };

const DISPLAY_STATUSES: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "deprecated", label: "Deprecated" },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="w-4 h-4 text-gray-400">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function VersionsClient({ groups }: { groups: VersionGroup[] }) {
  const router = useRouter();
  const [fCat, setFCat] = useState("Coat");
  const [fStatus, setFStatus] = useState(""); // "" = all
  const [search, setSearch] = useState("");
  const [editVer, setEditVer] = useState<{ id: string; ids: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startBulk] = useTransition();

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected((p) => { const n = new Set(p); for (const id of ids) { if (checked) n.add(id); else n.delete(id); } return n; });
  const runBulk = (fn: () => Promise<string | null>) =>
    startBulk(async () => {
      const msg = await fn();
      setSelected(new Set());
      router.refresh();
      if (msg) alert(msg);
    });

  const q = search.trim().toLowerCase();

  // Filter versions within each group by status + search; drop groups left empty. Category
  // filter applied separately so its counts stay live.
  const matched = useMemo(() => {
    return groups
      .map((g) => {
        const nameHit = q ? g.modelName.toLowerCase().includes(q) : false;
        const versions = g.versions.filter(
          (v) => (!fStatus || displayStatus(v) === fStatus) && (!q || nameHit || v.season.toLowerCase().includes(q))
        );
        return { ...g, versions };
      })
      .filter((g) => g.versions.length > 0);
  }, [groups, fStatus, q]);

  const catCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const g of matched) acc[g.modelCategory] = (acc[g.modelCategory] ?? 0) + 1;
    return acc;
  }, [matched]);
  const categories = useMemo(
    () => Object.keys(catCounts).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b)),
    [catCounts]
  );

  const shown = useMemo(() => (fCat ? matched.filter((g) => g.modelCategory === fCat) : matched), [matched, fCat]);
  const totalVersions = shown.reduce((s, g) => s + g.versions.length, 0);

  const seg = (active: boolean) =>
    `px-3 py-1 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3 flex-wrap">
        {/* Category filter — icon segmented control (matches the Products/Models lists) */}
        <div className="flex rounded-lg bg-gray-100 p-0.5 flex-wrap">
          <button type="button" onClick={() => setFCat("")} className={seg(fCat === "")} title="All categories">
            All <span className="opacity-50">{matched.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setFCat(c)} className={seg(fCat === c) + " flex items-center gap-1"} title={c} aria-label={c}>
              <span className="text-base leading-none">{CATEGORY_ICON[c] ?? "🏷"}</span>
              <span className="opacity-50 text-xs">{catCounts[c] ?? 0}</span>
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          <button type="button" onClick={() => setFStatus("")} className={seg(fStatus === "")}>All</button>
          {DISPLAY_STATUSES.map((s) => (
            <button key={s.value} type="button" onClick={() => setFStatus(s.value)} className={seg(fStatus === s.value)}>{s.label}</button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Search model or season..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
          />
        </div>
        <span className="text-xs text-gray-400">{shown.length} models · {totalVersions} versions</span>
      </div>

      <div className="space-y-4">
        {shown.map((g) => (
          <div key={g.modelId}>
            <div className="flex items-center gap-2 mb-1.5">
              <Link href={`/models/${g.modelId}`} className="text-sm font-medium text-gray-900 hover:underline">{g.modelName}</Link>
              <span className="text-xs text-gray-400">{g.modelCategory}</span>
              <span className="text-xs text-gray-300">· {g.versions.length} version{g.versions.length === 1 ? "" : "s"}</span>
            </div>
            <VersionsTable
              versions={g.versions}
              onOpen={(id) => setEditVer({ id, ids: g.versions.map((v) => v.id) })}
              selectable={{ selected, onToggle: toggle, onToggleAll: toggleAll }}
            />
          </div>
        ))}
        {!shown.length && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-10 text-center text-gray-400 text-sm">No versions match</div>
        )}
      </div>

      <BulkBar
        count={selected.size}
        pending={pending}
        deleteLabel="Delete"
        onArchive={() => runBulk(() => bulkArchiveModelVersions([...selected], true))}
        onUnarchive={() => runBulk(() => bulkArchiveModelVersions([...selected], false))}
        onDelete={() => { if (confirm(`Delete ${selected.size} version(s)? Versions with products are kept (unlink first).`)) runBulk(() => bulkDeleteModelVersions([...selected])); }}
        onClear={() => setSelected(new Set())}
      />

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
    </div>
  );
}
