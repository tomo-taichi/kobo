import Link from "next/link";
import { logout } from "@/app/actions/auth";

const links = [
  { href: "/seasons", label: "Seasons" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/materials", label: "Materials" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
];

export function Nav() {
  return (
    <nav className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold text-gray-900">KOBO</Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
