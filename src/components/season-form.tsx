"use client";

import { useActionState } from "react";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Props = {
  action: Action;
  initialName?: string;
  initialExchangeRate?: number | null;
  id?: string;
  onCancel?: () => void;
};

export function SeasonForm({ action, initialName = "", initialExchangeRate, id, onCancel }: Props) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {id && <input type="hidden" name="id" value={id} />}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            シーズン名 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            defaultValue={initialName}
            required
            placeholder="例: 26.2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            為替レート（JPY/EUR）<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            name="eur_jpy_rate"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={initialExchangeRate ?? ""}
            placeholder="例: 162.50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : id ? "更新" : "作成"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
