import { Nav } from "@/components/nav";
import { getCurrentProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex flex-col min-h-screen">
      <Nav isBrand={profile?.isBrand ?? false} isProduction={profile?.isProduction ?? false} />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
