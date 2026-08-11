import Link from "next/link";

// Segmented toggle to switch between the Models list and the (grouped) Versions list.
export function ModelsViewToggle({ current }: { current: "models" | "versions" }) {
  const cls = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
      <Link href="/models" className={cls(current === "models")}>Models</Link>
      <Link href="/model-versions" className={cls(current === "versions")}>Versions</Link>
    </div>
  );
}
