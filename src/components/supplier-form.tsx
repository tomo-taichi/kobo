"use client";

import { useActionState, useState } from "react";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

type Props = {
  action: Action;
  initial?: {
    name?: string;
    country?: string;
    address?: string;
    company_phone?: string;
    primary_name?: string;
    primary_title?: string;
    primary_mobile?: string;
    primary_email?: string;
    secondary_name?: string;
    secondary_title?: string;
    secondary_mobile?: string;
    secondary_email?: string;
    notes?: string;
  };
  id?: string;
  onCancel?: () => void;
};

const PRESET_COUNTRIES = ["日本", "イタリア", "中国", "アメリカ", "イギリス"];
const TITLES = ["社長", "担当者"];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-1 mb-3">
      {children}
    </h3>
  );
}

export function SupplierForm({ action, initial = {}, id, onCancel }: Props) {
  const [error, formAction, pending] = useActionState(action, null);

  const isPreset = !initial.country || PRESET_COUNTRIES.includes(initial.country);
  const [isCustom, setIsCustom] = useState(!isPreset);
  const [customCountry, setCustomCountry] = useState(isPreset ? "" : (initial.country ?? ""));

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setIsCustom(e.target.value === "__custom__");
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {id && <input type="hidden" name="id" value={id} />}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
      )}

      {/* 仕入先名 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          仕入先名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={initial.name ?? ""}
          required
          className={inputCls}
        />
      </div>

      {/* 会社情報 */}
      <div>
        <SectionHeading>会社情報</SectionHeading>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">国</label>
            {isCustom ? (
              <div className="flex gap-1">
                <input
                  name="country"
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder="国名を入力"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setIsCustom(false)}
                  className="px-2 text-gray-400 hover:text-gray-600 text-xs border border-gray-300 rounded-md"
                >
                  ↩
                </button>
              </div>
            ) : (
              <select
                name="country"
                defaultValue={initial.country ?? ""}
                onChange={handleCountryChange}
                className={inputCls + " bg-white"}
              >
                <option value="">— 選択 —</option>
                {PRESET_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">リスト追加（手入力）</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">住所</label>
            <input name="address" defaultValue={initial.address ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">会社電話番号</label>
            <input name="company_phone" type="tel" defaultValue={initial.company_phone ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* 代表担当者 */}
      <div>
        <SectionHeading>代表担当者</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
            <input name="primary_name" defaultValue={initial.primary_name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
            <select name="primary_title" defaultValue={initial.primary_title ?? ""} className={inputCls + " bg-white"}>
              <option value="">— 選択 —</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">携帯番号</label>
            <input name="primary_mobile" type="tel" defaultValue={initial.primary_mobile ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス</label>
            <input name="primary_email" type="email" defaultValue={initial.primary_email ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* サブ担当者 */}
      <div>
        <SectionHeading>サブ担当者</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">担当者名</label>
            <input name="secondary_name" defaultValue={initial.secondary_name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">タイトル</label>
            <select name="secondary_title" defaultValue={initial.secondary_title ?? ""} className={inputCls + " bg-white"}>
              <option value="">— 選択 —</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">携帯番号</label>
            <input name="secondary_mobile" type="tel" defaultValue={initial.secondary_mobile ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス</label>
            <input name="secondary_email" type="email" defaultValue={initial.secondary_email ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* メモ */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
        <textarea name="notes" defaultValue={initial.notes ?? ""} rows={2} className={inputCls} />
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
