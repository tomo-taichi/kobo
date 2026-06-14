"use client";

import { useState } from "react";
import { MaterialForm } from "@/components/material-form";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;
type Supplier = { id: string; name: string };
type Season  = { id: string; name: string };

export function MaterialNewModal({
  action,
  suppliers,
  seasons,
  pastColors = [],
}: {
  action: Action;
  suppliers: Supplier[];
  seasons: Season[];
  pastColors?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700"
      >
        NEW
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">新規素材作成</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <MaterialForm
              action={action}
              suppliers={suppliers}
              seasons={seasons}
              pastColors={pastColors}
              onCancel={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
