"use client";

import { useActionState } from "react";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Props = {
  action: Action;
  initialLabel?: string;
  id?: string;
};

export function CompositionOptionForm({ action, initialLabel = "", id }: Props) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      {id && <input type="hidden" name="id" value={id} />}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}
      <div className="flex gap-2">
        <input
          name="label"
          defaultValue={initialLabel}
          required
          placeholder="例: ｶｼﾐｱ-cashmere 100%"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "保存中..." : id ? "更新" : "追加"}
        </button>
      </div>
    </form>
  );
}
