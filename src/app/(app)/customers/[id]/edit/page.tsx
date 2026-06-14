import { redirect } from "next/navigation";

export default async function CustomerEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/customers/${id}/info`);
}
