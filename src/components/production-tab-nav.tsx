"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// ADR-0010 Phase A — shared tab bar for the 6 Production pages of one season,
// with a season switcher to jump between seasons on the same page.
export type ProductionTab = "progress" | "kanban" | "finishing" | "hours" | "master-list" | "material-order";

const TABS: { key: ProductionTab; label: string; path: (id: string) => string; external?: boolean }[] = [
  { key: "progress", label: "Progress", path: (id) => `/seasons/${id}/production` },
  { key: "kanban", label: "Kanban", path: (id) => `/seasons/${id}/production/kanban` },
  { key: "finishing", label: "Finishing", path: (id) => `/seasons/${id}/production/finishing` },
  { key: "hours", label: "Hours", path: (id) => `/seasons/${id}/production/hours` },
  { key: "master-list", label: "Master List", path: (id) => `/seasons/${id}/production/master-list`, external: true },
  { key: "material-order", label: "Material Order", path: (id) => `/seasons/${id}/material-orders` },
];

export function ProductionTabNav({
  seasonId,
  seasons,
  active,
}: {
  seasonId: string;
  seasons: { id: string; name: string }[];
  active: ProductionTab;
}) {
  const router = useRouter();
  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
      <div className="flex items-center gap-2">
        <Link href="/production" className="text-sm text-gray-500 hover:text-gray-900">← Production</Link>
        <select
          value={seasonId}
          onChange={(e) => {
            if (e.target.value !== seasonId) router.push(activeTab.path(e.target.value));
          }}
          className="text-xs px-2 py-1 border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-gray-900"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.path(seasonId)}
            target={t.external ? "_blank" : undefined}
            rel={t.external ? "noopener noreferrer" : undefined}
            className={`text-xs px-3 py-1.5 rounded ${
              active === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
