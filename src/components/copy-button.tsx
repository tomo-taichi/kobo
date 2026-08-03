"use client";

import { useState } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={className ?? "text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100"}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
