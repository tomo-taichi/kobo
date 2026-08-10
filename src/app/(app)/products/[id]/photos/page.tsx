import { redirect } from "next/navigation";

// Photos are now a section on the unified edit page.
export default async function ProductPhotosRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${id}/edit`);
}
