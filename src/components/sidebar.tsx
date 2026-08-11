"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { isProductionPath } from "@/lib/nav-paths";

// ADR-0010 UI refresh (Phase 1) — left sidebar shell. Brand/Production switch at
// the top, section links with icons, user card + logout at the bottom.
const ICON_PATHS: Record<string, string> = {
  calendar: "M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 21h15a1.5 1.5 0 001.5-1.5V6.75A1.5 1.5 0 0019.5 5.25h-15A1.5 1.5 0 003 6.75V19.5A1.5 1.5 0 004.5 21z",
  layers: "M12 3.75L3.75 8.25 12 12.75l8.25-4.5L12 3.75zM3.75 12L12 16.5l8.25-4.5M3.75 15.75L12 20.25l8.25-4.5",
  users: "M15 9a3 3 0 11-6 0 3 3 0 016 0zM4.5 19.5a7.5 7.5 0 0115 0",
  tag: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a2.25 2.25 0 003.182 0l4.318-4.318a2.25 2.25 0 000-3.182L11.16 3.66A2.25 2.25 0 009.568 3zM6 6.75h.008",
  receipt: "M4.5 3.75h15A1.5 1.5 0 0121 5.25v15.75l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5.25A1.5 1.5 0 014.5 3.75zM7.5 8.25h9M7.5 11.25h9M7.5 14.25h5",
  cog: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.32.19.686.257 1.037.15l1.256-.38c.523-.158 1.087.077 1.35.55l1.296 2.247c.263.473.14 1.07-.29 1.404l-1.01.784a1.5 1.5 0 00-.575 1.28c.01.117.01.234 0 .35a1.5 1.5 0 00.575 1.281l1.01.784c.43.334.553.93.29 1.404l-1.296 2.247c-.263.473-.827.708-1.35.55l-1.256-.38a1.5 1.5 0 00-1.037.15 1.5 1.5 0 00-.645.87l-.213 1.28c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.397-1.11-.94l-.213-1.28a1.5 1.5 0 00-.645-.87 1.5 1.5 0 00-1.037-.15l-1.256.38c-.523.158-1.087-.077-1.35-.55L2.87 15.32c-.263-.474-.14-1.07.29-1.404l1.01-.784a1.5 1.5 0 00.575-1.28 3.5 3.5 0 010-.35 1.5 1.5 0 00-.575-1.281l-1.01-.784c-.43-.334-.553-.93-.29-1.404l1.296-2.247c.263-.473.827-.708 1.35-.55l1.256.38c.351.107.717.04 1.037-.15a1.5 1.5 0 00.645-.87l.213-1.281z",
  squares: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  key: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
  logout: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25",
  panel: "M3.75 5.25A1.5 1.5 0 015.25 3.75h13.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25zM9 3.75v16.5",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d={ICON_PATHS[name]} />
      {name === "cog" && <circle cx="12" cy="12" r="2.75" />}
    </svg>
  );
}

const BRAND_LINKS = [
  { href: "/seasons", label: "Seasons", icon: "calendar" },
  { href: "/materials", label: "Materials", icon: "layers", sub: [{ href: "/suppliers", label: "Suppliers" }] },
  { href: "/customers", label: "Customers", icon: "users" },
  { href: "/products", label: "Products", icon: "tag", sub: [{ href: "/models", label: "Models" }, { href: "/model-versions", label: "Versions" }] },
  { href: "/orders", label: "Orders", icon: "receipt" },
  { href: "/settings", label: "Settings", icon: "cog" },
];
const PRODUCTION_LINKS = [{ href: "/production", label: "Production", icon: "squares" }];

export function Sidebar({ isBrand, isProduction, displayName }: { isBrand: boolean; isProduction: boolean; displayName: string | null }) {
  const pathname = usePathname() ?? "";
  const production = isProductionPath(pathname);
  const showSwitcher = isBrand && isProduction;
  const links = isProduction && !isBrand ? PRODUCTION_LINKS : isBrand && !isProduction ? BRAND_LINKS : production ? PRODUCTION_LINKS : BRAND_LINKS;
  const initial = (displayName ?? "?").trim().charAt(0).toUpperCase() || "?";

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("kobo.sidebar.collapsed") === "1");
  }, []);
  const toggle = () => setCollapsed((v) => { localStorage.setItem("kobo.sidebar.collapsed", v ? "0" : "1"); return !v; });

  const seg = (active: boolean) =>
    `flex-1 text-center px-2 py-1.5 rounded-md transition-colors ${active ? "bg-white shadow-sm text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`;

  const item = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg text-sm transition-colors ${collapsed ? "justify-center px-0 py-2" : "px-2.5 py-2"} ${active ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`;

  return (
    <aside className={`${collapsed ? "w-14" : "w-44"} shrink-0 border-r border-gray-200 flex flex-col bg-white normal-case transition-[width] duration-150`}>
      {/* Logo + collapse toggle */}
      <div className={`h-14 flex items-center shrink-0 ${collapsed ? "justify-center px-0" : "px-3 gap-2"}`}>
        <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">K</div>
        {!collapsed && <span className="font-semibold text-gray-900 flex-1">KOBO</span>}
        {!collapsed && (
          <button type="button" onClick={toggle} title="Collapse sidebar" className="text-gray-400 hover:text-gray-900 p-1">
            <Icon name="panel" />
          </button>
        )}
      </div>

      {collapsed && (
        <button type="button" onClick={toggle} title="Expand sidebar" className="mx-auto mb-1 text-gray-400 hover:text-gray-900 p-1">
          <Icon name="panel" />
        </button>
      )}

      {/* Brand / Production switch (hidden when collapsed) */}
      {showSwitcher && !collapsed && (
        <div className="mx-3 mb-1 flex rounded-lg bg-gray-100 p-0.5 text-xs">
          <Link href="/seasons" className={seg(!production)}>Brand</Link>
          <Link href="/production" className={seg(production)}>Production</Link>
        </div>
      )}

      {/* Nav */}
      <nav className={`py-2 flex-1 overflow-y-auto flex flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        {links.map((l) => {
          const sub = (l as { sub?: { href: string; label: string }[] }).sub;
          const selfActive = pathname === l.href || pathname.startsWith(l.href + "/");
          const subActive = sub?.some((s) => pathname === s.href || pathname.startsWith(s.href + "/")) ?? false;
          const active = selfActive || subActive;
          return (
            <div key={l.href}>
              <Link href={l.href} className={item(selfActive)} title={collapsed ? l.label : undefined}>
                <Icon name={l.icon} />
                {!collapsed && l.label}
              </Link>
              {/* Sub-menu — shown when the section is active (expanded sidebar only) */}
              {!collapsed && sub && active && (
                <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-gray-200 pl-2">
                  {sub.map((s) => {
                    const sa = pathname === s.href || pathname.startsWith(s.href + "/");
                    return (
                      <Link key={s.href} href={s.href}
                        className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors ${sa ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom: account + logout */}
      <div className={`pb-3 pt-2 border-t border-gray-100 flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}>
        <Link href="/account/password" className={item(false)} title={collapsed ? "Reset password" : undefined}>
          <Icon name="key" />
          {!collapsed && "Reset password"}
        </Link>
        {collapsed ? (
          <form action={logout} className="flex justify-center">
            <button type="submit" title="Log out" className="text-gray-400 hover:text-gray-900 p-2 transition-colors">
              <Icon name="logout" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">{initial}</div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-900 truncate" title={displayName ?? ""}>{displayName ?? "—"}</div>
            </div>
            <form action={logout}>
              <button type="submit" title="Log out" className="text-gray-400 hover:text-gray-900 p-1 transition-colors">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
