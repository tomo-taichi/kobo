import { createClient } from "@/lib/supabase/server";

// ADR-0010 — the current user's profile (functions). user_type is the hard
// security boundary; internal users carry Brand/Production/admin flags.
export type Profile = {
  id: string;
  displayName: string | null;
  userType: "internal" | "client";
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  customerId: string | null;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, user_type, is_brand, is_production, can_create_users, customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = data;
  return {
    id: d.id,
    displayName: d.display_name ?? null,
    userType: d.user_type === "client" ? "client" : "internal",
    isBrand: !!d.is_brand,
    isProduction: !!d.is_production,
    canCreateUsers: !!d.can_create_users,
    customerId: d.customer_id ?? null,
  };
}

// Where a user lands: client → portal, brand → app home, production-only → the
// production hub. Kept accessible so redirects never loop.
export function homeForProfile(p: { userType: string; isBrand: boolean; isProduction: boolean }): string {
  if (p.userType === "client") return "/portal";
  if (p.isBrand) return "/";
  if (p.isProduction) return "/production";
  return "/";
}
