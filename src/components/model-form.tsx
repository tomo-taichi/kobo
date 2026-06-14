"use client";

import { useActionState } from "react";
import { MODEL_CATEGORIES, MODEL_GENDERS } from "@/lib/model-constants";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Props = {
  action: Action;
  initialName?: string;
  initialCategory?: string;
  initialGender?: string;
  id?: string;
};

export function ModelForm({ action, initialName = "", initialCategory = "", initialGender = "", id }: Props) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      {id && <input type="hidden" name="id" value={id} />}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">モデル名 *</label>
        <input
          name="name"
          defaultValue={initialName}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー *</label>
          <select
            name="category"
            defaultValue={initialCategory}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">選択...</option>
            {MODEL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">性別 *</label>
          <select
            name="gender"
            defaultValue={initialGender}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">選択...</option>
            {MODEL_GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50 w-fit"
      >
        {pending ? "保存中..." : id ? "更新" : "作成"}
      </button>
    </form>
  );
}
