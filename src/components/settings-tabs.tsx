"use client";

import { useState, type ReactNode } from "react";

// ADR-0009 Phase 3 (Settings) — left sub-menu + centre content, one section at a
// time so the page doesn't need scrolling.
export function SettingsTabs({ sections }: { sections: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(sections[0]?.key ?? "");
  const current = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div className="flex gap-6 items-start">
      <nav className="w-52 shrink-0 space-y-1">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              current?.key === s.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-w-0">
        {current && (
          <>
            <h2 className="text-base font-medium text-gray-800 border-b border-gray-200 pb-2 mb-4">{current.label}</h2>
            {current.content}
          </>
        )}
      </div>
    </div>
  );
}
