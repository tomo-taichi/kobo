"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "info",     label: "Company Info" },
  { seg: "orders",   label: "Order History" },
  { seg: "products", label: "Product History" },
  { seg: "payments", label: "Payment History" },
] as const;

export function CustomerTabNav({ id }: { id: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6">
      {TABS.map((tab) => {
        const href = `/customers/${id}/${tab.seg}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.seg}
            href={href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
