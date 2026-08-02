"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClientUser } from "@/app/actions/users";

// ADR-0010 Phase B4 — invite a client (portal) user tied to this customer.
export function ClientUserForm({ customerId }: { customerId: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () =>
    startTransition(async () => {
      const err = await createClientUser({ email, displayName: name, customerId });
      if (err) {
        setError(err);
        setDone(false);
      } else {
        setError(null);
        setDone(true);
        setEmail("");
        setName("");
        router.refresh();
      }
    });

  const inputCls = "px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="contact@client.com" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional)</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <button
        onClick={submit}
        disabled={isPending || !email.trim()}
        className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? "Inviting…" : "Invite"}
      </button>
      {done && <span className="text-xs text-green-600">✓ Invite sent</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
