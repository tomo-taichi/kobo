import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/reset-password-form";

// Reachable by any authenticated user (internal or client). Lets users change
// their admin-set initial password themselves. Allowed through in proxy.ts.
export default async function AccountPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reset Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Signed in as {user.email}. Set a new password below.
          </p>
        </div>
        <ResetPasswordForm />
        <div className="pt-2 border-t border-gray-100">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-900">← Back</Link>
        </div>
      </div>
    </div>
  );
}
