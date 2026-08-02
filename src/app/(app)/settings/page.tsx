import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { SETTINGS_GROUPS, getListOptions, type ListOption } from "@/lib/list-options";
import { ListManager } from "@/components/list-manager";
import { PricingSettingsForm } from "@/components/pricing-settings-form";
import { ManufacturingPresetsForm } from "@/components/manufacturing-presets-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { BanksManager } from "@/components/banks-manager";
import { getManufacturingPresets } from "@/lib/manufacturing-presets";
import { getBanks } from "@/lib/banks";

// ADR-0009 Phase 3 (Settings) — Brand-user hub. Left sub-menu selects a section;
// only the wired ("ready") lists are editable, others show as placeholders.
// NOTE: currently visible to all authenticated users — every current user is a
// Brand user. Real Brand-only gating arrives with ADR-0008 roles.
export default async function SettingsPage() {
  const supabase = await createClient();

  const readyDomains = SETTINGS_GROUPS.flatMap((g) => g.domains.filter((d) => d.ready).map((d) => d.domain));
  const [entries, settingsRes, mfgPresets, banks] = await Promise.all([
    Promise.all(readyDomains.map(async (d) => [d, await getListOptions(supabase, d)] as const)),
    supabase.from("company_settings").select("cost_eur_rate_default, labor_rate_jpy_per_hour").limit(1).maybeSingle(),
    getManufacturingPresets(supabase),
    getBanks(supabase),
  ]);
  const optionsByDomain = new Map<string, ListOption[]>(entries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings: any = settingsRes.data ?? {};

  const sections = [
    {
      key: "pricing",
      label: "Pricing",
      content: (
        <PricingSettingsForm
          costEurRate={Number(settings.cost_eur_rate_default) || 130}
          laborRate={Number(settings.labor_rate_jpy_per_hour) || 2000}
        />
      ),
    },
    {
      key: "manufacturing",
      label: "Manufacturing Autofill",
      content: <ManufacturingPresetsForm presets={mfgPresets} />,
    },
    ...SETTINGS_GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      content: (
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
      ),
    })),
    {
      key: "customers",
      label: "Customers",
      content: (
        <div>
          <p className="text-xs text-gray-500 mb-3">
            Banks and their payment details. A customer’s selected bank prints on their invoices.
          </p>
          <BanksManager banks={banks} />
        </div>
      ),
    },
  ];

  const me = await getCurrentProfile();
  const isAdmin = me?.userType === "internal" && me.isBrand && me.canCreateUsers;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the lists and options used across the app.</p>
        </div>
        {isAdmin && (
          <Link
            href="/settings/users"
            className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 shrink-0"
          >
            Users →
          </Link>
        )}
      </div>
      <SettingsTabs sections={sections} />
    </div>
  );
}
