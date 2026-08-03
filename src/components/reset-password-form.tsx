"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/app/actions/auth";

// Self-service password change for the logged-in user. New password + confirm.
export function ResetPasswordForm() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    if (pw.length < 8) return setError("Password must be at least 8 characters");
    if (pw !== confirm) return setError("Passwords do not match");
    startTransition(async () => {
      const err = await changeOwnPassword(pw);
      if (err) {
        setError(err);
      } else {
        setDone(true);
        setPw("");
        setConfirm("");
      }
    });
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="space-y-3 max-w-sm">
      {done && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Password updated. Use it next time you sign in.
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
        <input type="password" value={pw} autoComplete="new-password" onChange={(e) => { setPw(e.target.value); setDone(false); }} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
        <input type="password" value={confirm} autoComplete="new-password" onChange={(e) => { setConfirm(e.target.value); setDone(false); }} className={inputCls} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending || pw.length < 8 || confirm.length < 8}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Updating…" : "Update password"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
