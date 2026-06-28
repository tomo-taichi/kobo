// Shared loading skeletons for route-level loading.tsx files. Rendered instantly on
// navigation (Suspense fallback) while the server component fetches data.

// List/index pages: title bar + toolbar + a few rows.
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-9 w-28 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex gap-2">
          <div className="h-8 flex-1 max-w-md bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-52 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-100 rounded animate-pulse ml-auto" />
              <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Detail pages: content-only card with form-row blocks. Nests cleanly under a tab
// layout (the real header/tabs persist) and also reads fine on standalone pages.
export function DetailSkeleton({ blocks = 6 }: { blocks?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5">
      {Array.from({ length: blocks }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
