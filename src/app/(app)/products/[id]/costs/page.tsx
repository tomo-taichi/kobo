import { redirect } from "next/navigation";

// Materials & Cost is now merged into the Basic Info page (single scroll-minimised
// view). Keep this route as a redirect so old links still land correctly.
export default async function ProductCostsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${id}/edit`);
}
