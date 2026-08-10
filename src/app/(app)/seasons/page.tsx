import { createClient } from "@/lib/supabase/server";
import { SeasonNewToggle } from "@/components/season-new-toggle";
import { SeasonsClient } from "@/components/seasons-client";
import { createSeason } from "@/app/actions/seasons";

export default async function SeasonsPage() {
  const supabase = await createClient();
  const [{ data: seasons }, { data: stats }] = await Promise.all([
    supabase.from("seasons").select("id, name, eur_jpy_rate, client_discount_rate, archived, created_at").order("name", { ascending: false }),
    supabase.rpc("get_season_stats"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statMap = new Map((stats ?? []).map((s: any) => [s.season_id, s]));
  const seasonsWithStats = (seasons ?? []).map((s: any) => ({ ...s, stat: statMap.get(s.id) ?? null }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Seasons</h1>
        <SeasonNewToggle action={createSeason} />
      </div>

      <SeasonsClient seasons={seasonsWithStats as any} />
    </div>
  );
}
