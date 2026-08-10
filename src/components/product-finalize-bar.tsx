"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductFinalized } from "@/app/actions/products";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 118 0v3.5" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

// Product-level Complete Status control. Draft = editable; Finalised = locked
// (read-only) until unlocked. Toggling refreshes the page so the forms re-lock.
export function ProductFinalizeBar({ productId, status }: { productId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const final = status === "final";

  const toggle = () =>
    start(async () => {
      const err = await setProductFinalized(productId, !final);
      if (err) { alert(err); return; }
      router.refresh();
    });

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${final ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={final ? "text-amber-600" : "text-gray-400"}>{final ? <LockIcon /> : <EditIcon />}</span>
        <span className={`text-sm font-semibold ${final ? "text-amber-700" : "text-gray-800"}`}>{final ? "Finalised" : "Draft"}</span>
        <span className="text-xs text-gray-400 truncate">
          {final ? "Locked (read-only) — Unlock to edit." : "Editable — Finalise to lock this product."}
        </span>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`shrink-0 text-sm px-3.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
          final
            ? "border border-amber-300 text-amber-700 hover:bg-amber-100"
            : "bg-gray-900 text-white hover:bg-gray-700"
        }`}
      >
        {pending ? "…" : final ? "Unlock" : "Finalise (Lock)"}
      </button>
    </div>
  );
}
