"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(
  _state: string | null,
  formData: FormData
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return "Incorrect email or password";
  }

  // Route by function: client → portal, brand → app, production-only → hub.
  const { data: prof } = await supabase
    .from("profiles")
    .select("user_type, is_brand, is_production")
    .eq("id", data.user.id)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = prof;
  const home = !p ? "/" : p.user_type === "client" ? "/portal" : p.is_brand ? "/" : p.is_production ? "/production" : "/";

  redirect(home);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Self-service password change for the logged-in user (internal or client). The
// admin-set password is only an initial one; users change it themselves here.
// No email / SMTP — updates the current session's own password.
export async function changeOwnPassword(newPassword: string): Promise<string | null> {
  if (!newPassword || newPassword.length < 8) return "Password must be at least 8 characters";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "Not signed in";

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return error.message;
  return null;
}
