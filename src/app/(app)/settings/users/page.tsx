import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listInternalUsers } from "@/lib/users";
import { InternalUserForm } from "@/components/internal-user-form";
import { InternalUserRow } from "@/components/internal-user-row";

// ADR-0010 Phase B4 — internal (staff) user management (admins only: Brand + can_create_users).
// Client (portal) users are managed per-customer under Customers → Users.
export default async function UsersPage() {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) redirect("/settings");

  const users = await listInternalUsers();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900">← Settings</Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Internal Users</h1>
        <p className="text-sm text-gray-500 mt-1">
          Internal staff have Brand/Production functions. Nickname + Cutter/Sewer flags feed Production assignment.
          Client (portal) users are created from a customer’s Users tab.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {users.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">No users</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <InternalUserRow
                key={u.id}
                canManage
                data={{
                  userId: u.id,
                  email: u.email ?? "—",
                  nickname: u.nickname,
                  isBrand: u.isBrand,
                  isProduction: u.isProduction,
                  canCreateUsers: u.canCreateUsers,
                  isCutter: u.isCutter,
                  isSewer: u.isSewer,
                  isProtected: u.protected,
                  isSelf: u.id === me.id,
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <InternalUserForm />
    </div>
  );
}
