"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

// ADR-0010 Phase A — top nav with a Brand / Production switcher.
// (Phase B will show the switcher only for users who have both functions.)
const BRAND_LINKS = [
  { href: "/seasons", label: "Seasons" },
  { href: "/materials", label: "Materials" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/settings", label: "Settings" },
];

function isProductionPath(p: string): boolean {
  return (
    p === "/production" ||
    p.startsWith("/production/") ||
    /^\/seasons\/[^/]+\/(production|material-orders)/.test(p)
  );
}

export function Nav() {
  const pathname = usePathname() ?? "";
  const production = isProductionPath(pathname);

  return (
    <nav className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold text-gray-900">KOBO</Link>

        {/* Brand / Production switcher */}
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          <Link
            href="/seasons"
            className={`px-3 py-1 ${!production ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Brand
          </Link>
          <Link
            href="/production"
            className={`px-3 py-1 ${production ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            Production
          </Link>
        </div>

        {/* Mode-specific links */}
        <div className="flex items-center gap-5">
          {production ? (
            <Link href="/production" className="text-sm text-gray-500 hover:text-gray-900">Seasons</Link>
          ) : (
            BRAND_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))
          )}
        </div>
      </div>

      <form action={logout}>
        <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Log out
        </button>
      </form>
    </nav>
  );
}
