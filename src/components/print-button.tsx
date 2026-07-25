"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={className ?? "no-print text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"}
    >
      Print / Save as PDF
    </button>
  );
}
