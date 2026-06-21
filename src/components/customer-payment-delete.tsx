"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePaymentEntry } from "@/app/actions/customer-payments";

export function CustomerPaymentDelete({
  entryId,
  customerId,
}: {
  entryId: string;
  customerId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleDelete() {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    start(async () => {
      await deletePaymentEntry(entryId, customerId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-gray-300 hover:text-red-500 text-sm disabled:opacity-50"
    >
      ×
    </button>
  );
}
