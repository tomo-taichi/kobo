import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isProductionPath, isPortalPath } from "@/lib/nav-paths";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — required for @supabase/ssr
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    // ADR-0010 — gate by the user's functions (internal Brand/Production, or client).
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_type, is_brand, is_production")
      .eq("id", user.id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = prof;

    const home =
      !p ? "/" : p.user_type === "client" ? "/portal" : p.is_brand ? "/" : p.is_production ? "/production" : "/";

    if (isLoginPage) {
      return NextResponse.redirect(new URL(home, request.url));
    }

    if (p) {
      const prodPath = isProductionPath(pathname);
      const portalPath = isPortalPath(pathname);
      const client = p.user_type === "client";

      let denied = false;
      if (client) {
        denied = !portalPath; // clients live in the portal only
      } else if (portalPath) {
        denied = true; // internal users can't use the portal
      } else if (prodPath) {
        denied = !p.is_production;
      } else {
        // Brand section: production-only internal users are blocked; brand (or
        // function-less, to avoid loops) users are allowed.
        denied = !!p.is_production && !p.is_brand;
      }

      if (denied && pathname !== home) {
        return NextResponse.redirect(new URL(home, request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
