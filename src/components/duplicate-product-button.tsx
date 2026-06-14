"use client";

import { useTransition } from "react";
import { duplicateProduct } from "@/app/actions/products";

export function DuplicateProductButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      duplicateProduct(productId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-xs px-3 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
