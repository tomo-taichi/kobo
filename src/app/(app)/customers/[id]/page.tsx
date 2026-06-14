import { redirect } from "next/navigation";

export default async function CustomerIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/customers/${id}/info`);
}
