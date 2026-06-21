"use client";

import { useState } from "react";
import { SupplierForm } from "@/components/supplier-form";

type Action = (_state: string | null, formData: FormData) => Promise<string | null>;

export function SupplierNewModal({ action }: { action: Action }) {
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">New Supplier</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <SupplierForm action={action} onCancel={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
