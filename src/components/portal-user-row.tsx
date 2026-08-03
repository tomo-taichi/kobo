"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientUser, adminResetClientPassword } from "@/app/actions/users";
import { generatePassword } from "@/lib/password";
import { CopyButton } from "@/components/copy-button";

// One portal user row: reset password (admin, for lock-outs) + delete. Both are
// Brand-gated server-side; this component only shows when the viewer can manage.
export function PortalUserRow({
  userId,
  customerId,
  email,
  displayName,
  canManage,
}: {
  userId: string;
  customerId: string;
  email: string;
  displayName: string | null;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newPw, setNewPw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onReset = () => {
    const pw = generatePassword();
    setError(null);
    startTransition(async () => {
      const err = await adminResetClientPassword({ userId, customerId, password: pw });
      if (err) {
        setError(err);
        setNewPw(null);
      } else {
        setNewPw(pw);
      }
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete portal user ${email}? They will lose access immediately.`)) return;
    setError(null);
    startTransition(async () => {
      const err = await deleteClientUser({ userId, customerId });
      if (err) setError(err);
      else router.refresh();
    });
  };

  return (
    <li className="py-1.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-gray-900">{email || "—"}</span>
        {canManage ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onReset}
              disabled={isPending}
              className="text-xs px-2 py-0.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              Reset password
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="text-xs px-2 py-0.5 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : displayName && displayName !== email ? (
          <span className="text-xs text-gray-400">{displayName}</span>
        ) : null}
      </div>

      {newPw && (
        <div className="rounded bg-green-50 border border-green-200 p-2 text-xs text-green-800 flex items-center justify-between gap-2">
          <span>
            New password for <b>{email}</b>: <code className="font-mono">{newPw}</code>
          </span>
          <CopyButton
            text={`${email} / ${newPw}`}
            className="text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-100"
          />
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </li>
  );
}
