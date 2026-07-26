import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// ADR-0009 Phase 3 — Production hub (top-menu entry).
// The Kanban and Master List are season-scoped, so the global "Production" menu
// item lands here: a list of seasons with quick links into each one's tools.
export default async function ProductionHubPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("id, name").order("created_at", { ascending: false });
  const seasons = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Production</h1>

      {seasons.length === 0 ? (
        <p className="text-gray-400 text-sm">No seasons yet.</p>
      ) : (
        <div className="space-y-3">
          {seasons.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="font-medium text-gray-900">{s.name}</span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/seasons/${s.id}/production/kanban`}
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
                >
                  Kanban
                </Link>
                <Link
                  href={`/seasons/${s.id}/production/hours`}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Hours
                </Link>
                <Link
                  href={`/seasons/${s.id}/production`}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Progress
                </Link>
                <Link
                  href={`/seasons/${s.id}/production/master-list`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Master List
                </Link>
                <Link
                  href={`/seasons/${s.id}/material-orders`}
                  className="text-xs px-3 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Material Order
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
