import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SeasonForm } from "@/components/season-form";
import { updateSeason } from "@/app/actions/seasons";

export default async function SeasonEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: season } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!season) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/seasons" className="text-sm text-gray-500 hover:text-gray-900">
          ← シーズン一覧
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900">シーズン編集</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-w-md">
        <SeasonForm action={updateSeason} initialName={season.name} id={season.id} />
      </div>
    </div>
  );
}
