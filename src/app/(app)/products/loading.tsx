export default function ProductsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
        <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Toolbar skeleton */}
        <div className="px-4 py-3 border-b border-gray-200 flex gap-2">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-8 w-28 bg-gray-100 rounded animate-pulse ml-auto" />
        </div>
        {/* Row skeletons */}
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-56 bg-gray-200 rounded animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-6 w-10 bg-gray-100 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex gap-5">
                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 min-w-[220px]">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-3 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
