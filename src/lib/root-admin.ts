// Protected root admin(s) — the brand owner's account. These are permanent Brand
// admins: the user-management actions refuse to delete or downgrade them, and the
// UI shows a "Protected" badge instead of any destructive control.
export const ROOT_ADMIN_EMAILS = ["tomo@taichimurakami.com"];

export function isRootAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return ROOT_ADMIN_EMAILS.some((r) => r.toLowerCase() === e);
}
