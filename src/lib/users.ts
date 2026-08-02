import { createAdminClient } from "@/lib/supabase/admin";

// ADR-0010 Phase B4 — user listing (server only; uses the service-role client).
export type ManagedUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  userType: "internal" | "client";
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  customerId: string | null;
  customerName: string | null;
};

async function loadUsers(): Promise<ManagedUser[]> {
  const admin = createAdminClient();
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin
      .from("profiles")
      .select("id, display_name, user_type, is_brand, is_production, can_create_users, customer_id, customers(name)"),
  ]);
  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? null]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((profiles ?? []) as any[]).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? null,
    displayName: p.display_name ?? null,
    userType: p.user_type === "client" ? "client" : "internal",
    isBrand: !!p.is_brand,
    isProduction: !!p.is_production,
    canCreateUsers: !!p.can_create_users,
    customerId: p.customer_id ?? null,
    customerName: p.customers?.name ?? null,
  }));
}

export async function listUsers(): Promise<ManagedUser[]> {
  return (await loadUsers()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
}

export async function listCustomerUsers(customerId: string): Promise<ManagedUser[]> {
  return (await loadUsers()).filter((u) => u.userType === "client" && u.customerId === customerId);
}
