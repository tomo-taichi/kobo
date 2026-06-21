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

const PRESET_COUNTRIES = ["Japan", "Italy", "China", "USA", "UK"];
const TITLES = ["President", "Contact Person"];

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

      {/* Supplier name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Supplier Name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          defaultValue={initial.name ?? ""}
          required
          className={inputCls}
        />
      </div>

      {/* Company info */}
      <div>
        <SectionHeading>Company Info</SectionHeading>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
            {isCustom ? (
              <div className="flex gap-1">
                <input
                  name="country"
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder="Enter country name"
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
                <option value="">— Select —</option>
                {PRESET_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">Add to list (manual entry)</option>
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input name="address" defaultValue={initial.address ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Company Tel</label>
            <input name="company_phone" type="tel" defaultValue={initial.company_phone ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Primary contact person */}
      <div>
        <SectionHeading>Primary Contact Person</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
            <input name="primary_name" defaultValue={initial.primary_name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <select name="primary_title" defaultValue={initial.primary_title ?? ""} className={inputCls + " bg-white"}>
              <option value="">— Select —</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mobile</label>
            <input name="primary_mobile" type="tel" defaultValue={initial.primary_mobile ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input name="primary_email" type="email" defaultValue={initial.primary_email ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Secondary contact person */}
      <div>
        <SectionHeading>Secondary Contact Person</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contact Person</label>
            <input name="secondary_name" defaultValue={initial.secondary_name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <select name="secondary_title" defaultValue={initial.secondary_title ?? ""} className={inputCls + " bg-white"}>
              <option value="">— Select —</option>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mobile</label>
            <input name="secondary_mobile" type="tel" defaultValue={initial.secondary_mobile ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input name="secondary_email" type="email" defaultValue={initial.secondary_email ?? ""} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea name="notes" defaultValue={initial.notes ?? ""} rows={2} className={inputCls} />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : id ? "Update" : "Create"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
