import { redirect } from "next/navigation";

export default async function OrderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/orders/${id}/info`);
}
