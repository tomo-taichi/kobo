"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "edit",  label: "Basic Info" },
  { seg: "costs", label: "Materials & Cost" },
  { seg: "care",  label: "Care & Logistics" },
];

export function ProductTabNav({ id }: { id: string }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {TABS.map((t) => {
        const href = `/products/${id}/${t.seg}`;
        const active = pathname === href;
        return active ? (
          <span key={t.seg} className="px-4 py-2 text-sm font-medium text-gray-900 border-b-2 border-gray-900 -mb-px">
            {t.label}
          </span>
        ) : (
          <Link key={t.seg} href={href} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
