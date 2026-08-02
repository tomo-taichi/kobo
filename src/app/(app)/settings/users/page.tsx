import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { InternalUserForm } from "@/components/internal-user-form";

// ADR-0010 Phase B4 — user management (admins only: Brand + can_create_users).
export default async function UsersPage() {
  const me = await getCurrentProfile();
  if (!me || me.userType !== "internal" || !me.isBrand || !me.canCreateUsers) redirect("/settings");

  const users = await listUsers();

  const badge = (label: string) => (
    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-600">{label}</span>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-900">← Settings</Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Users</h1>
        <p className="text-sm text-gray-500 mt-1">
          Internal staff have Brand/Production functions. Client (portal) users are created from a customer’s page.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Functions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-900">{u.email ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{u.displayName ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600 capitalize">{u.userType}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.userType === "client"
                      ? badge(`Client · ${u.customerName ?? "—"}`)
                      : (
                        <>
                          {u.isBrand && badge("Brand")}
                          {u.isProduction && badge("Production")}
                          {u.canCreateUsers && badge("Admin")}
                        </>
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">No users</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InternalUserForm />
    </div>
  );
}
