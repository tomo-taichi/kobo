import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CompositionOptionForm } from "@/components/composition-option-form";
import { updateCompositionOption } from "@/app/actions/composition-options";

export default async function CompositionOptionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: option } = await supabase
    .from("composition_options")
    .select("id, label")
    .eq("id", id)
    .single();

  if (!option) notFound();

  return (
    <div className="space-y-6">
      <Link href="/composition-options" className="text-sm text-gray-500 hover:text-gray-900">
        ← Composition Options
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Edit Composition Option</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <CompositionOptionForm
          action={updateCompositionOption}
          initialLabel={option.label}
          id={option.id}
        />
      </div>
    </div>
  );
}
