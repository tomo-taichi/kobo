"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addListOption, deleteListOption } from "@/app/actions/list-options";
import type { ListOption } from "@/lib/list-options";

// ADR-0009 Phase 3 (Settings) — add/remove options for one managed list domain.
// withLabel: the domain stores a separate display label (e.g. unit meter → "m").
export function ListManager({
  domain,
  label,
  options,
  withLabel = false,
}: {
  domain: string;
  label: string;
  options: ListOption[];
  withLabel?: boolean;
}) {
  const [value, setValue] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const add = () => {
    if (!value.trim()) return;
    startTransition(async () => {
      const err = await addListOption(domain, value, withLabel ? labelInput : null);
      if (err) {
        setError(err);
      } else {
        setError(null);
        setValue("");
        setLabelInput("");
        router.refresh();
      }
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      await deleteListOption(id);
      router.refresh();
    });

  const inputCls = "px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-800 mb-3">{label}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {options.length === 0 ? (
          <span className="text-xs text-gray-400">No items yet</span>
        ) : (
          options.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1"
            >
              {withLabel && o.label ? (
                <span>
                  {o.value} <span className="text-gray-400">— {o.label}</span>
                </span>
              ) : (
                o.label ?? o.value
              )}
              <button
                disabled={isPending}
                onClick={() => remove(o.id)}
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${o.value}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Ignore Enter while an IME conversion is in progress — that Enter
            // confirms the candidate (e.g. Japanese kanji), it must not submit.
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          placeholder={withLabel ? "Value…" : `Add ${label.toLowerCase()}…`}
          className={inputCls + " flex-1 min-w-0"}
        />
        {withLabel && (
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Label (optional)"
            className={inputCls + " w-32"}
          />
        )}
        <button
          disabled={isPending || !value.trim()}
          onClick={add}
          className="text-sm px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 shrink-0"
        >
          Add
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
