"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBatchField, type BatchField } from "@/app/actions/production-batches";
import {
  BATCH_COLUMNS,
  CUT_SEW_FIN_STATUSES,
  PATTERN_STATES,
  PRIORITY_LEVELS,
  currentBatchStage,
  type BatchColumnKey,
} from "@/lib/production-constants";
import type { BatchClientOrder } from "@/lib/production-view";
import { SIZES } from "@/lib/order-constants";

export type BatchCard = {
  id: string;
  modelName: string;
  productNumber: string | null;
  colorName: string | null;
  orderedQty: number;
  priority: number;
  fabric_arrived: boolean;
  pattern_state: string;
  cut_status: string;
  sew_status: string;
  fin_status: string;
  cutter_name: string | null;
  sewer_name: string | null;
  mainMaterialName: string | null;
  orderDetails: BatchClientOrder[];
};

export function BatchKanban({
  seasonId,
  batches,
  cutterOptions,
  sewerOptions,
}: {
  seasonId: string;
  batches: BatchCard[];
  cutterOptions: string[];
  sewerOptions: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  const update = (id: string, field: BatchField, value: string | number | boolean | null) => {
    startTransition(async () => {
      await updateBatchField(id, seasonId, field, value);
      router.refresh();
    });
  };

  // Every assignee that could be filtered on: managed options plus any names already
  // on batches (in case a name was removed from the list after assignment).
  const assignees = Array.from(
    new Set([
      ...cutterOptions,
      ...sewerOptions,
      ...batches.flatMap((b) => [b.cutter_name, b.sewer_name].filter(Boolean) as string[]),
    ])
  ).sort((a, b) => a.localeCompare(b, "ja"));

  const shown = filter ? batches.filter((b) => b.cutter_name === filter || b.sewer_name === filter) : batches;

  const columns: Record<BatchColumnKey, BatchCard[]> = {
    fabric: [], pattern: [], cut: [], sew: [], finish: [], done: [],
  };
  for (const b of shown) columns[currentBatchStage(b)].push(b);
  for (const key of Object.keys(columns) as BatchColumnKey[]) {
    columns[key].sort((a, b) => b.priority - a.priority || a.modelName.localeCompare(b.modelName, "ja"));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Filter by assignee</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          <option value="">All ({batches.length})</option>
          {assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {filter && (
          <button onClick={() => setFilter("")} className="text-xs text-gray-400 hover:underline">
            clear
          </button>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {BATCH_COLUMNS.map((col) => (
          <div key={col.key} className="min-w-[230px] flex-1 bg-gray-50 rounded-lg border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-200 text-sm font-medium text-gray-800 flex items-center justify-between">
              <span>{col.label}</span>
              <span className="text-gray-400">{columns[col.key].length}</span>
            </div>
            <div className="p-2 space-y-2">
              {columns[col.key].map((b) => (
                <Card
                  key={b.id}
                  b={b}
                  col={col.key}
                  update={update}
                  disabled={isPending}
                  cutterOptions={cutterOptions}
                  sewerOptions={sewerOptions}
                />
              ))}
              {columns[col.key].length === 0 && <p className="text-xs text-gray-300 px-1 py-2">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({
  b,
  col,
  update,
  disabled,
  cutterOptions,
  sewerOptions,
}: {
  b: BatchCard;
  col: BatchColumnKey;
  update: (id: string, field: BatchField, value: string | number | boolean | null) => void;
  disabled: boolean;
  cutterOptions: string[];
  sewerOptions: string[];
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded p-2 text-xs space-y-1.5 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span className="font-medium text-gray-900 leading-tight">{b.modelName}</span>
        <span className="shrink-0 inline-flex items-center rounded bg-gray-900 text-white text-sm font-bold font-mono px-1.5 py-0.5">
          ×{b.orderedQty}
        </span>
      </div>
      {b.mainMaterialName ? (
        <div className="text-gray-500 truncate" title={b.mainMaterialName}>{b.mainMaterialName}</div>
      ) : null}
      <div className="text-gray-500">
        {b.colorName ?? "—"}
        {b.productNumber ? <span className="text-gray-400 font-mono"> · {b.productNumber}</span> : null}
      </div>
      <button
        onClick={() => setDetailOpen(true)}
        className="w-full text-[11px] font-semibold px-2 py-1.5 rounded bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-500 hover:to-indigo-500"
      >
        🔍 詳細を見る
      </button>
      {detailOpen && (
        <BatchDetailModal
          modelName={b.modelName}
          colorName={b.colorName}
          orderedQty={b.orderedQty}
          orders={b.orderDetails}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {/* Stage control for the current column */}
      {col === "fabric" && (
        <button
          disabled={disabled}
          onClick={() => update(b.id, "fabric_arrived", true)}
          className="w-full text-[11px] px-2 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          Fabric is ready
        </button>
      )}
      {col === "pattern" && (
        <Segmented
          options={PATTERN_STATES.map((s) => ({ value: s.key, label: s.label }))}
          value={b.pattern_state}
          disabled={disabled}
          onSet={(v) => update(b.id, "pattern_state", v)}
        />
      )}
      {col === "cut" && (
        <Segmented
          options={CUT_SEW_FIN_STATUSES.map((s) => ({ value: s, label: cap(s) }))}
          value={b.cut_status}
          disabled={disabled}
          onSet={(v) => update(b.id, "cut_status", v)}
        />
      )}
      {col === "sew" && (
        <Segmented
          options={CUT_SEW_FIN_STATUSES.map((s) => ({ value: s, label: cap(s) }))}
          value={b.sew_status}
          disabled={disabled}
          onSet={(v) => update(b.id, "sew_status", v)}
        />
      )}
      {col === "finish" && (
        <Segmented
          options={CUT_SEW_FIN_STATUSES.map((s) => ({ value: s, label: cap(s) }))}
          value={b.fin_status}
          disabled={disabled}
          onSet={(v) => update(b.id, "fin_status", v)}
        />
      )}
      {col === "done" && <div className="text-green-600 font-medium">✓ Complete</div>}

      {/* Assignees (from the managed Settings lists) */}
      <div className="grid grid-cols-2 gap-1">
        <AssigneeSelect
          value={b.cutter_name}
          options={cutterOptions}
          placeholder="Cutter"
          disabled={disabled}
          onSet={(v) => update(b.id, "cutter_name", v)}
        />
        <AssigneeSelect
          value={b.sewer_name}
          options={sewerOptions}
          placeholder="Sewer"
          disabled={disabled}
          onSet={(v) => update(b.id, "sewer_name", v)}
        />
      </div>

      {/* Priority */}
      <select
        value={b.priority}
        disabled={disabled}
        onChange={(e) => update(b.id, "priority", Number(e.target.value))}
        className="w-full px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
      >
        {PRIORITY_LEVELS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}

function BatchDetailModal({
  modelName,
  colorName,
  orderedQty,
  orders,
  onClose,
}: {
  modelName: string;
  colorName: string | null;
  orderedQty: number;
  orders: BatchClientOrder[];
  onClose: () => void;
}) {
  const sizeStr = (sizes: { size: string; qty: number }[]) =>
    [...sizes]
      .sort(
        (a, b) =>
          SIZES.indexOf(a.size as (typeof SIZES)[number]) - SIZES.indexOf(b.size as (typeof SIZES)[number])
      )
      .map((s) => `${s.size}:${s.qty}`)
      .join("  ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <div className="text-sm text-gray-500">Order detail · ×{orderedQty}</div>
            <div className="text-lg font-semibold text-gray-900">
              {modelName} <span className="text-gray-500 font-normal">/ {colorName ?? "—"}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="overflow-auto">
          {orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400">No order lines for this batch.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Client</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Sizes</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{o.customerName ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{sizeStr(o.sizes) || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-900">{o.units}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={2} className="px-4 py-2 text-right font-medium text-gray-700">Total</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                    {orders.reduce((a, o) => a + o.units, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 text-right">
          <button onClick={onClose} className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-100">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AssigneeSelect({
  value,
  options,
  placeholder,
  disabled,
  onSet,
}: {
  value: string | null;
  options: string[];
  placeholder: string;
  disabled: boolean;
  onSet: (v: string | null) => void;
}) {
  // Keep a legacy value that's no longer in the managed list still selectable.
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onSet(e.target.value || null)}
      className="px-1.5 py-0.5 border border-gray-200 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
    >
      <option value="">{placeholder}</option>
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Segmented({
  options,
  value,
  onSet,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSet: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onSet(o.value)}
          className={`flex-1 text-[10px] px-1 py-0.5 rounded border disabled:opacity-50 ${
            value === o.value
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
