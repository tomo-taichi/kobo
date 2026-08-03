"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInternalUser } from "@/app/actions/users";
import { generatePassword } from "@/lib/password";
import { CopyButton } from "@/components/copy-button";

// ADR-0010 Phase B4 — create an internal (staff) user: email + an auto-generated
// 8-char password (copyable) + Brand/Production/admin functions.
export function InternalUserForm() {
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isBrand, setIsBrand] = useState(true);
  const [isProduction, setIsProduction] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [isCutter, setIsCutter] = useState(false);
  const [isSewer, setIsSewer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setPassword(generatePassword()), []);

  const submit = () =>
    startTransition(async () => {
      const err = await createInternalUser({
        email,
        password,
        nickname,
        isBrand,
        isProduction,
        canCreateUsers: canCreate,
        isCutter,
        isSewer,
      });
      if (err) {
        setError(err);
      } else {
        setError(null);
        setCreated({ email, password });
        setEmail("");
        setNickname("");
        setPassword(generatePassword());
        setIsBrand(true);
        setIsProduction(false);
        setCanCreate(false);
        setIsCutter(false);
        setIsSewer(false);
        router.refresh();
      }
    });

  const inputCls = "w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3 max-w-md">
      <h3 className="text-sm font-medium text-gray-800">Add internal user</h3>

      {created && (
        <div className="rounded bg-green-50 border border-green-200 p-2 text-xs text-green-800 flex items-center justify-between gap-2">
          <span>Created <b>{created.email}</b> · password <code className="font-mono">{created.password}</code></span>
          <CopyButton text={`${created.email} / ${created.password}`} className="text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-100" />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@company.com" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nickname (shown in Production) *</label>
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputCls} placeholder="e.g. Taro" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Password (auto-generated)</label>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={password} className={inputCls + " font-mono bg-gray-50"} />
          <CopyButton text={password} />
          <button type="button" onClick={() => setPassword(generatePassword())} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 shrink-0">↻</button>
        </div>
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
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isCutter} onChange={(e) => setIsCutter(e.target.checked)} /> Cutter
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={isSewer} onChange={(e) => setIsSewer(e.target.checked)} /> Sewer
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending || !email.trim() || !nickname.trim() || password.length < 6 || (!isBrand && !isProduction)}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create user"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
