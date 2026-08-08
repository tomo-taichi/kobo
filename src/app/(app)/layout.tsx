import { Sidebar } from "@/components/sidebar";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="h-screen bg-gray-100 flex sm:p-3">
      <div className="flex-1 flex min-w-0 bg-white sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-sm overflow-hidden">
        <Sidebar
          isBrand={profile?.isBrand ?? false}
          isProduction={profile?.isProduction ?? false}
          displayName={profile?.displayName ?? null}
        />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-6 max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
