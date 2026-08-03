"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientUser } from "@/app/actions/users";
import { generatePassword } from "@/lib/password";
import { CopyButton } from "@/components/copy-button";

// ADR-0010 Phase B4 — create a client (portal) user tied to this customer:
// email + an auto-generated 8-char password (copyable).
export function ClientUserForm({ customerId }: { customerId: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setPassword(generatePassword()), []);

  const submit = () =>
    startTransition(async () => {
      const err = await createClientUser({ email, password, customerId });
      if (err) {
        setError(err);
      } else {
        setError(null);
        setCreated({ email, password });
        setEmail("");
        setPassword(generatePassword());
        router.refresh();
      }
    });

  const inputCls = "w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="space-y-2 max-w-md">
      {created && (
        <div className="rounded bg-green-50 border border-green-200 p-2 text-xs text-green-800 flex items-center justify-between gap-2">
          <span>Created <b>{created.email}</b> · password <code className="font-mono">{created.password}</code></span>
          <CopyButton text={`${created.email} / ${created.password}`} className="text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-100" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="contact@client.com" required />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Password (auto-generated)</label>
        <div className="flex items-center gap-2">
          <input type="text" readOnly value={password} className={inputCls + " font-mono bg-gray-50"} />
          <CopyButton text={password} />
          <button type="button" onClick={() => setPassword(generatePassword())} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 shrink-0">↻</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending || !email.trim() || password.length < 6}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Add user"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
