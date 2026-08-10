import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductEditView } from "@/components/product-edit-view";
import { loadProductEditBundle } from "@/lib/product-edit-data";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const bundle = await loadProductEditBundle(supabase, id);
  if (!bundle) notFound();
  return <ProductEditView bundle={bundle} />;
}
