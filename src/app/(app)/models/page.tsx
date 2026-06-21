import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModelForm } from "@/components/model-form";
import { createModel } from "@/app/actions/models";
import { MODEL_CATEGORIES, MODEL_GENDERS } from "@/lib/model-constants";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; gender?: string }>;
}) {
  const { category, gender } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("models").select("id, name, category, gender").order("name");
  if (category) query = query.eq("category", category);
  if (gender) query = query.eq("gender", gender);
  const { data: models } = await query;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Models</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">New</h2>
        <ModelForm action={createModel} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex gap-3 items-center">
          <form method="get" className="flex gap-2 items-center flex-wrap">
            <select
              name="category"
              defaultValue={category ?? ""}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">All Categories</option>
              {MODEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              name="gender"
              defaultValue={gender ?? ""}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="">All Sexes</option>
              {MODEL_GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <button type="submit" className="px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200">
              Filter
            </button>
            {(category || gender) && (
              <Link href="/models" className="text-xs text-gray-500 hover:text-gray-900 underline">
                Clear
              </Link>
            )}
          </form>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sex</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {models?.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{m.name}</td>
                <td className="px-4 py-3 text-gray-500">{m.category}</td>
                <td className="px-4 py-3 text-gray-500">{m.gender}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/models/${m.id}/edit`}
                    className="text-gray-500 hover:text-gray-900 text-xs underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!models?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                  No models
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
