"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTimeLog } from "@/app/actions/time-logs";
import type { TimeLogEntry } from "@/lib/time-logs";

export function TimeLogEntries({ seasonId, entries }: { seasonId: string; entries: TimeLogEntry[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  if (entries.length === 0) return null;

  const del = (id: string) =>
    startTransition(async () => {
      await deleteTimeLog(id, seasonId);
      router.refresh();
    });

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-800">Entries</div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Worker</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Stage</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">Batch</th>
            <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-gray-600">{e.workDate ?? "—"}</td>
              <td className="px-4 py-2 text-gray-900">{e.workerName}</td>
              <td className="px-4 py-2 text-gray-600 capitalize">{e.stage}</td>
              <td className="px-4 py-2 text-gray-600">
                {e.modelName}
                {e.colorName ? <span className="text-gray-400"> · {e.colorName}</span> : null}
              </td>
              <td className="px-4 py-2 text-right font-mono">{e.hours}h</td>
              <td className="px-4 py-2 text-right">
                <button
                  disabled={isPending}
                  onClick={() => del(e.id)}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
