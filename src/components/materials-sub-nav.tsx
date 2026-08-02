import Link from "next/link";

// Materials ⇄ Suppliers sub-nav (Suppliers is reached from Materials, not the top menu).
export function MaterialsSubNav({ active }: { active: "materials" | "suppliers" }) {
  const tabs = [
    { key: "materials", label: "Materials", href: "/materials" },
    { key: "suppliers", label: "Suppliers", href: "/suppliers" },
  ] as const;
  return (
    <div className="flex gap-1 border-b border-gray-200 pb-2">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`text-sm px-3 py-1.5 rounded ${
            active === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
