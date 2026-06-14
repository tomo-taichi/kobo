export default function ProductDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-7 w-14 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Product name */}
      <div className="space-y-2">
        <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        <div className="h-8 w-72 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 pb-px">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-gray-100 rounded-t animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-9 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
