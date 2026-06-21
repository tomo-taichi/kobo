import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompositionOptionForm } from "@/components/composition-option-form";
import {
  createCompositionOption,
  moveCompositionOptionUp,
  moveCompositionOptionDown,
} from "@/app/actions/composition-options";

export default async function CompositionOptionsPage() {
  const supabase = await createClient();
  const { data: options } = await supabase
    .from("composition_options")
    .select("id, label, sort_order")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Composition Options</h1>
      <p className="text-sm text-gray-500">
        Manage the composition choices printed on product tags. Enter them in half-width katakana + English format.
      </p>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Add New</h2>
        <CompositionOptionForm action={createCompositionOption} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-12">Order</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {options?.map((opt, i) => (
              <tr key={opt.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3 text-gray-900 font-mono">{opt.label}</td>
                <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                  <form action={moveCompositionOptionUp.bind(null, opt.id)}>
                    <button
                      type="submit"
                      disabled={i === 0}
                      className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs border border-gray-200 rounded hover:bg-gray-50"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveCompositionOptionDown.bind(null, opt.id)}>
                    <button
                      type="submit"
                      disabled={i === (options?.length ?? 0) - 1}
                      className="px-2 py-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs border border-gray-200 rounded hover:bg-gray-50"
                    >
                      ↓
                    </button>
                  </form>
                  <Link
                    href={`/composition-options/${opt.id}/edit`}
                    className="text-gray-500 hover:text-gray-900 text-xs underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!options?.length && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No composition options
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
