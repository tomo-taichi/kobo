"use client";

import { formatHours } from "@/lib/presets";
import type { VersionRow } from "@/lib/version-rows";

// Display status is derived from the production lock, not the raw active/frozen value:
// Locked (a finalised product uses it) → Locked; deprecated → Deprecated; else → Active (editable).
export function displayStatus(v: { status: string; locked: boolean }): "active" | "locked" | "deprecated" {
  return v.locked ? "locked" : v.status === "deprecated" ? "deprecated" : "active";
}
const DISPLAY_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-100 text-green-700" },
  locked: { label: "Locked", cls: "bg-blue-100 text-blue-700" },
  deprecated: { label: "Deprecated", cls: "bg-amber-100 text-amber-700" },
};

export function StatusBadge({ status, locked }: { status: string; locked: boolean }) {
  const s = DISPLAY_STATUS[displayStatus({ status, locked })];
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

// Shared Versions table (Season / Status / Lining / Products / Materials / Sizes /
// Total / Mfg / Changelog). Row click → onOpen(id); the Products count links to the
// version's linked products. Used by the Model detail page and the Models list expansion.
type Selectable = { selected: Set<string>; onToggle: (id: string) => void; onToggleAll: (ids: string[], checked: boolean) => void };

export function VersionsTable({ versions, onOpen, selectable }: { versions: VersionRow[]; onOpen: (id: string) => void; selectable?: Selectable }) {
  const td = "px-4 py-2.5";
  const allSel = !!selectable && versions.length > 0 && versions.every((v) => selectable.selected.has(v.id));
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {selectable && (
              <th className="px-4 py-2.5 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSel}
                  onChange={(e) => selectable.onToggleAll(versions.map((v) => v.id), e.target.checked)}
                  className="align-middle accent-gray-900" />
              </th>
            )}
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Season</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Lining</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600">Products</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600">Materials</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600">Sizes</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600">Mfg</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600">Changelog</th>
            <th className="text-right px-4 py-2.5 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {versions.map((v) => (
            <tr key={v.id} onClick={() => onOpen(v.id)} className={`cursor-pointer hover:bg-gray-50 ${selectable?.selected.has(v.id) ? "bg-gray-50" : ""}`}>
              {selectable && (
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selectable.selected.has(v.id)} onChange={() => selectable.onToggle(v.id)} aria-label={`Select ${v.season}`} className="align-middle accent-gray-900" />
                </td>
              )}
              <td className={`${td} text-gray-900 whitespace-nowrap`}>{v.season}</td>
              <td className={td}><StatusBadge status={v.status} locked={v.locked} /></td>
              <td className={`${td} text-gray-500 max-w-[10rem] truncate`} title={v.lining_label}>
                {v.lining_label === "None" ? <span className="text-gray-300">None</span> : v.lining_label}
              </td>
              <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                {v.product_count > 0 ? (
                  <a href={`/products?version=${v.id}`} target="_blank" rel="noopener" title="View linked products"
                    className="inline-flex items-center text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900">{v.product_count}</a>
                ) : (
                  <span className="text-gray-300 text-xs">0</span>
                )}
              </td>
              <td className={`${td} text-center text-gray-500`}>{v.material_count}</td>
              <td className={`${td} text-center text-gray-500`}>{v.sizes_count}</td>
              <td className={`${td} text-right text-gray-700 font-mono whitespace-nowrap`}>¥{v.total_cost.toLocaleString()}</td>
              <td className={`${td} text-right text-gray-500 whitespace-nowrap`}>{formatHours(v.mfg_hours)}h</td>
              <td className={`${td} text-gray-500 max-w-xs truncate`} title={v.changelog ?? ""}>{v.changelog ?? "—"}</td>
              <td className={`${td} text-right text-xs text-gray-400 whitespace-nowrap`}>{v.locked || v.status === "deprecated" ? "View →" : "Edit →"}</td>
            </tr>
          ))}
          {!versions.length && (
            <tr><td colSpan={selectable ? 11 : 10} className="px-4 py-8 text-center text-gray-400 text-sm">No versions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
