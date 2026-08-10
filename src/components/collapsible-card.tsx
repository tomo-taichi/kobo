"use client";

import { useState } from "react";

// A card whose body collapses. Children stay MOUNTED when collapsed (hidden via
// display:none) so wrapped <form> inputs keep their values and still submit.
export function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  right,
  subtitle,
  accent = false,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`rounded-lg border bg-white ${accent ? "border-gray-900/20 shadow-sm ring-1 ring-gray-900/5" : "border-gray-200"}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left min-w-0" aria-expanded={open}>
          <svg viewBox="0 0 24 24" className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className={`font-semibold text-gray-800 truncate ${accent ? "text-base" : "text-sm"}`}>{title}</span>
          {subtitle && <span className="text-xs text-gray-400 truncate">{subtitle}</span>}
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className={open ? "px-5 pb-5" : "hidden"}>{children}</div>
    </section>
  );
}
