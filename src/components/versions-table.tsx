"use client";

import { formatHours } from "@/lib/presets";
import type { VersionRow } from "@/lib/version-rows";

// Status is just Active / Deprecated. Locked/unlocked is a separate axis shown by the
// leading lock icon (Deprecated ⇒ always locked; Active locks once a product is batched).
export function displayStatus(v: { status: string }): "active" | "deprecated" {
  return v.status === "deprecated" ? "deprecated" : "active";
}

function LockClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 118 0v3.5" />
    </svg>
  );
}
function LockOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 017.5-2" />
    </svg>
  );
}

type Selectable = { selected: Set<string>; onToggle: (id: string) => void; onToggleAll: (ids: string[], checked: boolean) => void };

export function VersionsTable({ versions, onOpen, selectable }: { versions: VersionRow[]; onOpen: (id: string) => void; selectable?: Selectable }) {
  const td = "px-3 py-2.5";
  const allSel = !!selectable && versions.length > 0 && versions.every((v) => selectable.selected.has(v.id));
  const cols = 8 + (selectable ? 1 : 0);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {selectable && (
              <th className="px-3 py-2.5 w-8">
                <input type="checkbox" aria-label="Select all" checked={allSel}
                  onChange={(e) => selectable.onToggleAll(versions.map((v) => v.id), e.target.checked)}
                  className="align-middle accent-gray-900" />
              </th>
            )}
            <th className="px-3 py-2.5 w-8" aria-label="Lock" />
            <th className="text-left px-3 py-2.5 font-medium text-gray-600">Season</th>
            <th className="text-left px-3 py-2.5 font-medium text-gray-600">Lining</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">Materials</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">Sizes</th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">Total</th>
            <th className="text-right px-3 py-2.5 font-medium text-gray-600">Mfg</th>
            <th className="text-center px-3 py-2.5 font-medium text-gray-600">Products</th>
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
              <td className={td}>
                <span className={v.locked ? "text-gray-400" : "text-green-600"} title={v.locked ? "Locked" : "Unlocked (editable)"}>
                  {v.locked ? <LockClosedIcon /> : <LockOpenIcon />}
                </span>
              </td>
              <td className={`${td} whitespace-nowrap`}>
                <div className="text-gray-900">{v.season}</div>
                <div className={`text-[10px] font-medium ${v.status === "deprecated" ? "text-amber-600" : "text-green-600"}`}>
                  {v.status === "deprecated" ? "Deprecated" : "Active"}
                </div>
              </td>
              <td className={`${td} text-gray-500 max-w-[10rem] truncate`} title={v.lining_label}>
                {v.lining_label === "None" ? <span className="text-gray-300">None</span> : v.lining_label}
              </td>
              <td className={`${td} text-center text-gray-500`}>{v.material_count}</td>
              <td className={`${td} text-center text-gray-500`}>{v.sizes_count}</td>
              <td className={`${td} text-right text-gray-700 font-mono whitespace-nowrap`}>¥{v.total_cost.toLocaleString()}</td>
              <td className={`${td} text-right text-gray-500 whitespace-nowrap`}>{formatHours(v.mfg_hours)}h</td>
              <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                {v.product_count > 0 ? (
                  <a href={`/products?version=${v.id}`} target="_blank" rel="noopener" title="View linked products"
                    className="inline-flex items-center text-xs px-2 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900">{v.product_count}</a>
                ) : (
                  <span className="text-gray-300 text-xs">0</span>
                )}
              </td>
            </tr>
          ))}
          {!versions.length && (
            <tr><td colSpan={cols} className="px-4 py-8 text-center text-gray-400 text-sm">No versions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
