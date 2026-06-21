import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ModelForm } from "@/components/model-form";
import { updateModel } from "@/app/actions/models";

export default async function ModelEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: model } = await supabase
    .from("models")
    .select("id, name, category, gender")
    .eq("id", id)
    .single();

  if (!model) notFound();

  return (
    <div className="space-y-6">
      <Link href="/models" className="text-sm text-gray-500 hover:text-gray-900">
        ← Models
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">Edit Model</h1>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <ModelForm
          action={updateModel}
          initialName={model.name}
          initialCategory={model.category}
          initialGender={model.gender}
          id={model.id}
        />
      </div>
    </div>
  );
}
