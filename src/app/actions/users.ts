"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Only an internal admin (Brand + can_create_users) may create users.
async function requireAdmin(): Promise<string | null> {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) return "Not authorized";
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function invite(admin: any, email: string): Promise<{ id?: string; error?: string }> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) return { error: "That email already has an account" };
    return { error: error.message };
  }
  return { id: data?.user?.id };
}

export async function createInternalUser(input: {
  email: string;
  displayName: string;
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
}): Promise<string | null> {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const email = input.email.trim();
  if (!email) return "Email is required";
  if (!input.isBrand && !input.isProduction) return "Pick at least one function (Brand or Production)";

  const admin = createAdminClient();
  const { id, error } = await invite(admin, email);
  if (error) return error;
  if (!id) return "Failed to create user";

  const { error: pErr } = await admin.from("profiles").upsert({
    id,
    display_name: input.displayName.trim() || email,
    user_type: "internal",
    is_brand: input.isBrand,
    is_production: input.isProduction,
    can_create_users: input.canCreateUsers,
    customer_id: null,
  });
  if (pErr) return pErr.message;

  revalidatePath("/settings/users");
  return null;
}

export async function createClientUser(input: {
  email: string;
  displayName: string;
  customerId: string;
}): Promise<string | null> {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const email = input.email.trim();
  if (!email) return "Email is required";
  if (!input.customerId) return "Customer is required";

  const admin = createAdminClient();
  const { id, error } = await invite(admin, email);
  if (error) return error;
  if (!id) return "Failed to create user";

  const { error: pErr } = await admin.from("profiles").upsert({
    id,
    display_name: input.displayName.trim() || email,
    user_type: "client",
    is_brand: false,
    is_production: false,
    can_create_users: false,
    customer_id: input.customerId,
  });
  if (pErr) return pErr.message;

  revalidatePath(`/customers/${input.customerId}/info`);
  revalidatePath("/settings/users");
  return null;
}
