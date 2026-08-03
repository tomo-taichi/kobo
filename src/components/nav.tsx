"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { isProductionPath } from "@/lib/nav-paths";

// ADR-0010 — top nav with a Brand / Production switcher, gated by the user's
// functions. The switcher only shows when the user has both; otherwise the nav
// shows just the one section they can use.
const BRAND_LINKS = [
  { href: "/seasons", label: "Seasons" },
  { href: "/materials", label: "Materials" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/settings", label: "Settings" },
];

export function Nav({ isBrand, isProduction }: { isBrand: boolean; isProduction: boolean }) {
  const pathname = usePathname() ?? "";
  const production = isProductionPath(pathname);
  const showSwitcher = isBrand && isProduction;

  return (
    <nav className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold text-gray-900">KOBO</Link>

        {showSwitcher && (
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
        )}

        <div className="flex items-center gap-5">
          {/* In production mode (or production-only users), show the Production entry. */}
          {(production || (isProduction && !isBrand)) ? (
            isProduction && (
              <Link href="/production" className="text-sm text-gray-500 hover:text-gray-900">Seasons</Link>
            )
          ) : (
            isBrand &&
            BRAND_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/account/password" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Reset password
        </Link>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
