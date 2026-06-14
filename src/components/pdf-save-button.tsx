"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SavePdfResult } from "@/app/actions/pdf-storage";

type Props = {
  label: string;
  savedUrl: string | null;
  action: () => Promise<SavePdfResult>;
};

export function PdfSaveButton({ label, savedUrl: initialSavedUrl, action }: Props) {
  const [savedUrl, setSavedUrl] = useState(initialSavedUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("url" in result) {
        setSavedUrl(result.url);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="text-sm px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Generating…" : label}
        </button>
        {savedUrl && (
          <a
            href={savedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm px-3 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
          >
            Download saved
          </a>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
