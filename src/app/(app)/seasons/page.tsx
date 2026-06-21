import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SeasonNewToggle } from "@/components/season-new-toggle";
import { createSeason } from "@/app/actions/seasons";

export default async function SeasonsPage() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, eur_jpy_rate, created_at")
    .order("name", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Seasons</h1>
        <SeasonNewToggle action={createSeason} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Season Name</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Exchange Rate (JPY/EUR)</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {seasons?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/seasons/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(s as any).eur_jpy_rate != null
                    ? `¥${Number((s as any).eur_jpy_rate).toLocaleString()}`
                    : <span className="text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/seasons/${s.id}/production`} className="text-gray-500 hover:text-gray-900 text-xs underline">
                      Production Progress
                    </Link>
                    <Link href={`/seasons/${s.id}/material-orders`} className="text-gray-500 hover:text-gray-900 text-xs underline">
                      Material Order
                    </Link>
                    <Link href={`/seasons/${s.id}`} className="text-gray-500 hover:text-gray-900 text-xs underline">
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!seasons?.length && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No seasons
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
