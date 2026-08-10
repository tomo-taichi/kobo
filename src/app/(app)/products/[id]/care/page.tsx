import { redirect } from "next/navigation";

// Care & Logistics is now a section on the unified edit page.
export default async function ProductCareRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${id}/edit`);
}
