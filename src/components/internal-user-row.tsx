"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateInternalUser,
  adminResetInternalPassword,
  deleteInternalUser,
} from "@/app/actions/users";
import { generatePassword } from "@/lib/password";
import { CopyButton } from "@/components/copy-button";

export type InternalUserRowData = {
  userId: string;
  email: string;
  nickname: string | null;
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  isCutter: boolean;
  isSewer: boolean;
  isProtected: boolean;
  isSelf: boolean;
};

const badge = (label: string, tone: "gray" | "amber" = "gray") => (
  <span
    key={label}
    className={
      tone === "amber"
        ? "text-[10px] px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700"
        : "text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600"
    }
  >
    {label}
  </span>
);

export function InternalUserRow({ data, canManage }: { data: InternalUserRowData; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [newPw, setNewPw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [nickname, setNickname] = useState(data.nickname ?? "");
  const [isBrand, setIsBrand] = useState(data.isBrand);
  const [isProduction, setIsProduction] = useState(data.isProduction);
  const [canCreate, setCanCreate] = useState(data.canCreateUsers);
  const [isCutter, setIsCutter] = useState(data.isCutter);
  const [isSewer, setIsSewer] = useState(data.isSewer);

  // Brand/admin are locked for the protected root admin and for yourself.
  const lockAdmin = data.isProtected || data.isSelf;

  const save = () =>
    startTransition(async () => {
      const err = await updateInternalUser({
        userId: data.userId,
        nickname,
        isBrand,
        isProduction,
        canCreateUsers: canCreate,
        isCutter,
        isSewer,
      });
      if (err) setError(err);
      else {
        setError(null);
        setEditing(false);
        router.refresh();
      }
    });

  const reset = () => {
    const pw = generatePassword();
    setError(null);
    startTransition(async () => {
      const err = await adminResetInternalPassword({ userId: data.userId, password: pw });
      if (err) setError(err);
      else setNewPw(pw);
    });
  };

  const remove = () => {
    if (!confirm(`Delete ${data.email}? This removes their account and access.`)) return;
    setError(null);
    startTransition(async () => {
      const err = await deleteInternalUser({ userId: data.userId });
      if (err) setError(err);
      else router.refresh();
    });
  };

  const btn = "text-xs px-2 py-0.5 border rounded disabled:opacity-50";

  return (
    <li className="py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-gray-900 truncate">
            {data.email}
            {data.nickname ? <span className="text-gray-400"> · {data.nickname}</span> : null}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.isBrand && badge("Brand")}
            {data.isProduction && badge("Production")}
            {data.canCreateUsers && badge("Admin")}
            {data.isCutter && badge("Cutter")}
            {data.isSewer && badge("Sewer")}
            {data.isProtected && badge("Protected", "amber")}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setEditing((v) => !v)} disabled={isPending} className={btn + " border-gray-300 text-gray-700 hover:bg-gray-100"}>
              {editing ? "Close" : "Edit"}
            </button>
            <button type="button" onClick={reset} disabled={isPending} className={btn + " border-gray-300 text-gray-700 hover:bg-gray-100"}>
              Reset password
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={isPending || data.isProtected || data.isSelf}
              title={data.isProtected ? "Protected admin" : data.isSelf ? "You can't delete yourself" : undefined}
              className={btn + " border-red-200 text-red-600 hover:bg-red-50"}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {newPw && (
        <div className="rounded bg-green-50 border border-green-200 p-2 text-xs text-green-800 flex items-center justify-between gap-2">
          <span>
            New password for <b>{data.email}</b>: <code className="font-mono">{newPw}</code>
          </span>
          <CopyButton text={`${data.email} / ${newPw}`} className="text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-100" />
        </div>
      )}

      {editing && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nickname (shown in Production) *</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full max-w-xs px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="e.g. Taro"
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isBrand} disabled={lockAdmin} onChange={(e) => setIsBrand(e.target.checked)} /> Brand
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isProduction} onChange={(e) => setIsProduction(e.target.checked)} /> Production
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={canCreate} disabled={lockAdmin} onChange={(e) => setCanCreate(e.target.checked)} /> Can create users
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isCutter} onChange={(e) => setIsCutter(e.target.checked)} /> Cutter
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isSewer} onChange={(e) => setIsSewer(e.target.checked)} /> Sewer
            </label>
          </div>
          {lockAdmin && (
            <p className="text-[11px] text-gray-400">
              {data.isProtected ? "Protected admin — Brand & admin stay on." : "You can't remove your own admin rights."}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={save} disabled={isPending || !nickname.trim()} className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50">
              {isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </li>
  );
}
