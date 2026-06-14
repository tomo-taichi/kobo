"use client";

import { useState } from "react";
import { deleteProduct } from "@/app/actions/products";

export function DeleteProductButton({ productId, productName }: { productId: string; productName: string | null }) {
  const [open,    setOpen]    = useState(false);
  const [pending, setPending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteProduct(productId);
    if (result) {
      setError(result);
      setPending(false);
    }
    // on success, deleteProduct redirects — no need to close
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 border border-red-200 text-red-500 rounded-md hover:bg-red-50 hover:border-red-400"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && setOpen(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg">
                ⚠
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Delete product?</h2>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  <span className="font-medium text-gray-700">{productName ?? "This product"}</span>
                  {" "}will be permanently deleted. This action cannot be undone.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
