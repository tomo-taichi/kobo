"use client";

import { useRouter } from "next/navigation";
import { ProductEditView } from "@/components/product-edit-view";
import type { ProductEditBundle } from "@/lib/product-edit-data";

// Large popup that shows the full product edit view (same content as the /edit page).
// Auto-save happens inside the forms; refresh the list on close so row values update.
export function ProductEditModal({ bundle, onClose }: { bundle: ProductEditBundle; onClose: () => void }) {
  const router = useRouter();
  const close = () => { onClose(); router.refresh(); };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative bg-gray-50 rounded-xl shadow-2xl w-full max-w-6xl my-4">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur rounded-t-xl z-10">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            Edit product · {bundle.productName || "—"}
          </h2>
          <div className="flex items-center gap-3 shrink-0">
            <a href={`/products/${bundle.id}/edit`} target="_blank" rel="noopener"
              className="text-xs text-gray-500 hover:text-gray-900">Open full page ↗</a>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-900 text-sm">Close ✕</button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <ProductEditView bundle={bundle} />
        </div>
      </div>
    </div>
  );
}
