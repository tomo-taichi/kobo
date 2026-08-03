import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { listCustomerUsers } from "@/lib/users";
import { ClientUserForm } from "@/components/client-user-form";
import { PortalUserRow } from "@/components/portal-user-row";

// ADR-0010 Phase B4 — client (portal) users for a customer.
export default async function CustomerUsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: c }, me, portalUsers] = await Promise.all([
    supabase.from("customers").select("name").eq("id", id).single(),
    getCurrentProfile(),
    listCustomerUsers(id),
  ]);
  if (!c) notFound();

  const canManage = me?.userType === "internal" && me.isBrand;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div>
          <h2 className="text-base font-medium text-gray-800">Portal Users</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Client users can sign in to the customer portal to place orders and track progress.
          </p>
        </div>
        {portalUsers.length === 0 ? (
          <p className="text-xs text-gray-400">No portal users yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {portalUsers.map((u) => (
              <PortalUserRow
                key={u.id}
                userId={u.id}
                customerId={id}
                email={u.email ?? ""}
                displayName={u.displayName}
                canManage={canManage}
              />
            ))}
          </ul>
        )}
      </div>

      {canManage ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">Add portal user</h3>
          <ClientUserForm customerId={id} />
        </div>
      ) : (
        <p className="text-xs text-gray-400">Only Brand users can manage portal users.</p>
      )}
    </div>
  );
}
