import { createClient } from "@/lib/supabase/server";
import { SETTINGS_GROUPS, getListOptions, type ListOption } from "@/lib/list-options";
import { ListManager } from "@/components/list-manager";

// ADR-0009 Phase 3 (Settings) — Brand-user list management hub.
// Grouped by domain area. Only the wired ("ready") lists are editable today
// (Cutter / Sewer); the rest are shown as placeholders on the roadmap.
// NOTE: currently visible to all authenticated users — every current user is a
// Brand user. Real Brand-only gating arrives with ADR-0008 roles.
export default async function SettingsPage() {
  const supabase = await createClient();

  const readyDomains = SETTINGS_GROUPS.flatMap((g) => g.domains.filter((d) => d.ready).map((d) => d.domain));
  const entries = await Promise.all(
    readyDomains.map(async (d) => [d, await getListOptions(supabase, d)] as const)
  );
  const optionsByDomain = new Map<string, ListOption[]>(entries);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage the select-lists used across the app.</p>
      </div>

      {SETTINGS_GROUPS.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="text-base font-medium text-gray-800 border-b border-gray-200 pb-1">{g.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.domains.map((d) =>
              d.ready ? (
                <ListManager
                  key={d.domain}
                  domain={d.domain}
                  label={d.label}
                  options={optionsByDomain.get(d.domain) ?? []}
                  withLabel={d.withLabel}
                />
              ) : (
                <div key={d.domain} className="border border-dashed border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400">{d.label}</h3>
                  <p className="text-xs text-gray-300 mt-1">Coming soon</p>
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
