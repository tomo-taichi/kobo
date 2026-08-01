"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBank, updateBank, deleteBank } from "@/app/actions/banks";
import type { Bank } from "@/lib/banks";

// ADR-0009 Phase 3 (Settings › Customers) — manage banks + payment details.
// Each bank's details print on invoices for customers assigned to it.
export function BanksManager({ banks }: { banks: Bank[] }) {
  return (
    <div className="space-y-3 max-w-2xl">
      {banks.length === 0 && <p className="text-xs text-gray-400">No banks yet</p>}
      {banks.map((b) => (
        <BankCard key={b.id} bank={b} />
      ))}
      <AddBankForm />
    </div>
  );
}

const inputCls = "w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900";

function BankCard({ bank }: { bank: Bank }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(bank.label);
  const [details, setDetails] = useState(bank.details ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = label !== bank.label || details !== (bank.details ?? "");

  const save = () =>
    startTransition(async () => {
      const err = await updateBank(bank.id, label, details);
      if (err) setError(err);
      else { setError(null); setEditing(false); router.refresh(); }
    });
  const cancel = () => { setLabel(bank.label); setDetails(bank.details ?? ""); setError(null); setEditing(false); };
  const remove = () => startTransition(async () => { await deleteBank(bank.id); router.refresh(); });

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        {editing ? (
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls + " max-w-xs"} />
        ) : (
          <span className="text-sm font-medium text-gray-900">{bank.label}</span>
        )}
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setEditing(true)} className="text-xs px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-100">Edit</button>
            <button onClick={remove} disabled={isPending} className="text-xs px-3 py-1 text-gray-400 hover:text-red-600 disabled:opacity-50">Delete</button>
          </div>
        )}
      </div>
      {editing ? (
        <textarea
          value={details} onChange={(e) => setDetails(e.target.value)} rows={5}
          placeholder="Payment details (one per line) — printed on invoices…"
          className={inputCls + " font-mono"}
        />
      ) : (
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{bank.details || "—"}</pre>
      )}
      {editing && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={save}
            disabled={isPending || !dirty || !label.trim()}
            className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button onClick={cancel} disabled={isPending} className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}
    </div>
  );
}

function AddBankForm() {
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const add = () =>
    startTransition(async () => {
      const err = await addBank(label, details);
      if (err) setError(err);
      else { setError(null); setLabel(""); setDetails(""); router.refresh(); }
    });

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-2">
      <div className="text-xs font-medium text-gray-600">Add bank</div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bank name (e.g. WISE EU)" className={inputCls} />
      <textarea
        value={details} onChange={(e) => setDetails(e.target.value)} rows={4}
        placeholder="Payment details (one per line)…"
        className={inputCls + " font-mono"}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={add}
          disabled={isPending || !label.trim()}
          className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
