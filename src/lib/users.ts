import { createAdminClient } from "@/lib/supabase/admin";
import { isRootAdminEmail } from "@/lib/root-admin";

// ADR-0010 Phase B4 — user listing (server only; uses the service-role client).
export type ManagedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  nickname: string | null;
  userType: "internal" | "client";
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  isCutter: boolean;
  isSewer: boolean;
  customerId: string | null;
  customerName: string | null;
  protected: boolean;
};

async function loadUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("profiles")
      .select("id, display_name, nickname, user_type, is_brand, is_production, can_create_users, is_cutter, is_sewer, customer_id, customers(name)"),
  ]);
  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? null]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((profiles ?? []) as any[]).map((p) => {
    const email = emailById.get(p.id) ?? null;
    return {
      id: p.id,
      email,
      displayName: p.display_name ?? null,
      nickname: p.nickname ?? null,
      userType: p.user_type === "client" ? "client" : "internal",
      isBrand: !!p.is_brand,
      isProduction: !!p.is_production,
      canCreateUsers: !!p.can_create_users,
      isCutter: !!p.is_cutter,
      isSewer: !!p.is_sewer,
      customerId: p.customer_id ?? null,
      customerName: p.customers?.name ?? null,
      protected: isRootAdminEmail(email),
    };
  });
}

export async function listUsers(): Promise<ManagedUser[]> {
  return (await loadUsers()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

export async function listInternalUsers(): Promise<ManagedUser[]> {
  return (await listUsers()).filter((u) => u.userType === "internal");
}

export async function listCustomerUsers(customerId: string): Promise<ManagedUser[]> {
  return (await loadUsers()).filter((u) => u.userType === "client" && u.customerId === customerId);
}

// Nicknames of internal users flagged as cutters / sewers, for Production
// assignment. Uses the service-role client because RLS on profiles is own-row
// only — a production user can't read other users' profiles otherwise.
export async function listAssignees(): Promise<{ cutters: string[]; sewers: string[] }> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("nickname, is_cutter, is_sewer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).filter((r) => r.nickname);
  const uniqSorted = (xs: string[]) => Array.from(new Set(xs)).sort((a, b) => a.localeCompare(b, "ja"));
  return {
    cutters: uniqSorted(rows.filter((r) => r.is_cutter).map((r) => r.nickname as string)),
    sewers: uniqSorted(rows.filter((r) => r.is_sewer).map((r) => r.nickname as string)),
  };
}
