"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRootAdminEmail } from "@/lib/root-admin";

// Email of an auth user (for root-admin protection checks).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function emailOf(admin: any, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

// Only an internal admin (Brand + can_create_users) may manage internal users.
async function requireAdmin(): Promise<string | null> {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) return "Not authorized";
  return null;
}

// Any internal Brand user may manage portal (client) users.
async function requireBrand(): Promise<string | null> {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand) return "Not authorized";
  return null;
}

// Create the auth user directly with email + password (admin sets both; no invite
// email / SMTP dependency). email_confirm so the user can sign in immediately.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createAuthUser(admin: any, email: string, password: string): Promise<{ id?: string; error?: string }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already.*registered|already exists/i.test(error.message)) return { error: "That email already has an account" };
    return { error: error.message };
  }
  return { id: data?.user?.id };
}

export async function createInternalUser(input: {
  email: string;
  password: string;
  nickname: string;
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  isCutter: boolean;
  isSewer: boolean;
}): Promise<string | null> {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;

  const email = input.email.trim();
  const nickname = input.nickname.trim();
  if (!email) return "Email is required";
  if (!nickname) return "Nickname is required";
  if (!input.password || input.password.length < 6) return "Password must be at least 6 characters";
  if (!input.isBrand && !input.isProduction) return "Pick at least one function (Brand or Production)";

  const admin = createAdminClient();
  const { id, error } = await createAuthUser(admin, email, input.password);
  if (error) return error;
  if (!id) return "Failed to create user";

  const { error: pErr } = await admin.from("profiles").upsert({
    id,
    display_name: email,
    nickname,
    user_type: "internal",
    is_brand: input.isBrand,
    is_production: input.isProduction,
    can_create_users: input.canCreateUsers,
    is_cutter: input.isCutter,
    is_sewer: input.isSewer,
    customer_id: null,
  });
  if (pErr) {
    // Don't leave an orphaned auth user with no profile.
    await admin.auth.admin.deleteUser(id);
    return pErr.message;
  }

  revalidatePath("/settings/users");
  return null;
}

// Update an existing internal user's nickname / functions / production roles.
// The protected root admin can't be stripped of Brand or admin. An admin can't
// remove their own admin/brand (avoids locking themselves out of user management).
export async function updateInternalUser(input: {
  userId: string;
  nickname: string;
  isBrand: boolean;
  isProduction: boolean;
  canCreateUsers: boolean;
  isCutter: boolean;
  isSewer: boolean;
}): Promise<string | null> {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) return "Not authorized";
  const nickname = input.nickname.trim();
  if (!nickname) return "Nickname is required";
  if (!input.isBrand && !input.isProduction) return "Pick at least one function (Brand or Production)";

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("user_type").eq("id", input.userId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!prof || (prof as any).user_type !== "internal") return "User not found";

  let isBrand = input.isBrand;
  let canCreateUsers = input.canCreateUsers;

  const email = await emailOf(admin, input.userId);
  if (isRootAdminEmail(email)) {
    // Root admin stays a permanent Brand admin.
    isBrand = true;
    canCreateUsers = true;
  }
  if (input.userId === me.id) {
    // Don't let the acting admin remove their own admin rights.
    isBrand = true;
    canCreateUsers = true;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      nickname,
      is_brand: isBrand,
      is_production: input.isProduction,
      can_create_users: canCreateUsers,
      is_cutter: input.isCutter,
      is_sewer: input.isSewer,
    })
    .eq("id", input.userId);
  if (error) return error.message;

  revalidatePath("/settings/users");
  return null;
}

// Admin reset for an internal user's password (generated client-side).
export async function adminResetInternalPassword(input: {
  userId: string;
  password: string;
}): Promise<string | null> {
  const notAllowed = await requireAdmin();
  if (notAllowed) return notAllowed;
  if (!input.password || input.password.length < 8) return "Password must be at least 8 characters";

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("user_type").eq("id", input.userId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!prof || (prof as any).user_type !== "internal") return "User not found";

  const { error } = await admin.auth.admin.updateUserById(input.userId, { password: input.password });
  if (error) return error.message;
  return null;
}

// Delete an internal user. Refuses the protected root admin and self-deletion.
export async function deleteInternalUser(input: { userId: string }): Promise<string | null> {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) return "Not authorized";
  if (input.userId === me.id) return "You can't delete your own account";

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("user_type").eq("id", input.userId).maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!prof || (prof as any).user_type !== "internal") return "User not found";

  const email = await emailOf(admin, input.userId);
  if (isRootAdminEmail(email)) return "This is a protected admin and can't be deleted";

  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) return error.message;

  revalidatePath("/settings/users");
  return null;
}

export async function createClientUser(input: {
  email: string;
  password: string;
  customerId: string;
}): Promise<string | null> {
  const notAllowed = await requireBrand();
  if (notAllowed) return notAllowed;

  const email = input.email.trim();
  if (!email) return "Email is required";
  if (!input.password || input.password.length < 6) return "Password must be at least 6 characters";
  if (!input.customerId) return "Customer is required";

  const admin = createAdminClient();
  const { id, error } = await createAuthUser(admin, email, input.password);
  if (error) return error;
  if (!id) return "Failed to create user";

  const { error: pErr } = await admin.from("profiles").upsert({
    id,
    display_name: email,
    user_type: "client",
    is_brand: false,
    is_production: false,
    can_create_users: false,
    customer_id: input.customerId,
  });
  if (pErr) {
    // Don't leave an orphaned auth user with no profile.
    await admin.auth.admin.deleteUser(id);
    return pErr.message;
  }

  revalidatePath(`/customers/${input.customerId}/users`);
  return null;
}

// Delete a portal (client) user. Brand permission is enough. Guarded so a Brand
// user can only delete client users belonging to the given customer — never an
// internal user. Deleting the auth user cascades the profile row.
export async function deleteClientUser(input: { userId: string; customerId: string }): Promise<string | null> {
  const notAllowed = await requireBrand();
  if (notAllowed) return notAllowed;

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("user_type, customer_id")
    .eq("id", input.userId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prof as any;
  if (!p || p.user_type !== "client" || p.customer_id !== input.customerId) {
    return "That user is not a portal user for this customer";
  }

  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) return error.message;

  revalidatePath(`/customers/${input.customerId}/users`);
  return null;
}

// Admin reset for a locked-out portal user: sets a fresh password chosen by the
// Brand user (generated client-side). Same customer-scoped guard as delete.
export async function adminResetClientPassword(input: {
  userId: string;
  customerId: string;
  password: string;
}): Promise<string | null> {
  const notAllowed = await requireBrand();
  if (notAllowed) return notAllowed;
  if (!input.password || input.password.length < 8) return "Password must be at least 8 characters";

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("user_type, customer_id")
    .eq("id", input.userId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prof as any;
  if (!p || p.user_type !== "client" || p.customer_id !== input.customerId) {
    return "That user is not a portal user for this customer";
  }

  const { error } = await admin.auth.admin.updateUserById(input.userId, { password: input.password });
  if (error) return error.message;
  return null;
}
