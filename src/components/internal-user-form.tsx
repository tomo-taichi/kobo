"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInternalUser } from "@/app/actions/users";

// ADR-0010 Phase B4 — invite an internal (staff) user with Brand/Production/admin functions.
export function InternalUserForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isBrand, setIsBrand] = useState(true);
  const [isProduction, setIsProduction] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () =>
    startTransition(async () => {
      const err = await createInternalUser({
        email,
        displayName: name,
        isBrand,
        isProduction,
        canCreateUsers: canCreate,
      });
      if (err) {
        setError(err);
        setDone(false);
      } else {
        setError(null);
        setDone(true);
        setEmail("");
        setName("");
        setIsBrand(true);
        setIsProduction(false);
        setCanCreate(false);
        router.refresh();
      }
    });

  const inputCls = "w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 max-w-md">
      <h3 className="text-sm font-medium text-gray-800">Invite internal user</h3>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@company.com" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Display name (optional)</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isBrand} onChange={(e) => setIsBrand(e.target.checked)} /> Brand
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isProduction} onChange={(e) => setIsProduction(e.target.checked)} /> Production
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={canCreate} onChange={(e) => setCanCreate(e.target.checked)} /> Can create users
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending || !email.trim() || (!isBrand && !isProduction)}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Inviting…" : "Send invite"}
        </button>
        {done && <span className="text-xs text-green-600">✓ Invite sent</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
      <p className="text-[11px] text-gray-400">The user gets an email to set their password. (Requires SMTP configured in Supabase for real delivery.)</p>
    </div>
  );
}
