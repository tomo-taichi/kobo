"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { segment: "info",       label: "Order Info" },
  { segment: "products",   label: "Products" },
  { segment: "financials", label: "Financials" },
  { segment: "documents",  label: "Documents" },
];

export function OrderTabNav({ orderId }: { orderId: string }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-gray-200 pb-px">
      {TABS.map((tab) => {
        const href = `/orders/${orderId}/${tab.segment}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.segment}
            href={href}
            className={`px-4 py-2 text-sm rounded-t transition-colors ${
              active
                ? "bg-white border border-b-white border-gray-200 text-gray-900 font-medium -mb-px"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
