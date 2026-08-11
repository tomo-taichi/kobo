"use client";

import { MODEL_VERSION_STATUS_LABELS, type ModelVersionStatus } from "@/lib/model-constants";
import { formatHours } from "@/lib/presets";
import type { VersionRow } from "@/lib/version-rows";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  frozen: "bg-blue-100 text-blue-700",
  deprecated: "bg-amber-100 text-amber-700",
};

export function StatusBadge({ status }: { status: string }) {
  const label = MODEL_VERSION_STATUS_LABELS[status as ModelVersionStatus] ?? status;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600"}`}>
      {label}
    </span>
  );
}

// Shared Versions table (Season / Status / Lining / Products / Materials / Sizes /
// Total / Mfg / Changelog). Row click → onOpen(id); the Products count links to the
// version's linked products. Used by the Model detail page and the Models list expansion.
export function VersionsTable({ versions, onOpen }: { versions: VersionRow[]; onOpen: (id: string) => void }) {
  const td = "px-4 py-2.5";
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
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
            <tr key={v.id} onClick={() => onOpen(v.id)} className="cursor-pointer hover:bg-gray-50">
              <td className={`${td} text-gray-900 whitespace-nowrap`}>{v.season}</td>
              <td className={td}><StatusBadge status={v.status} /></td>
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
              <td className={`${td} text-right text-xs text-gray-400 whitespace-nowrap`}>{v.status === "deprecated" ? "View →" : "Edit →"}</td>
            </tr>
          ))}
          {!versions.length && (
            <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">No versions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
