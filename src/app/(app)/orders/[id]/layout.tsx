import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrderTabNav } from "@/components/order-tab-nav";
import { OrderStatusSelector } from "@/components/order-status-selector";

const STATUS_COLORS: Record<string, string> = {
  A: "bg-gray-100 text-gray-600",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  E: "bg-purple-100 text-purple-700",
  F: "bg-green-100 text-green-700",
};

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, invoice_type, order_date, customers(name), seasons(name)")
    .eq("id", id)
    .single();

  if (!order) notFound();
  const o = order as any;

  return (
    <div className="space-y-4">
      <Link href="/orders" className="text-sm text-gray-500 hover:text-gray-900">← Orders</Link>

      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-xl font-semibold text-gray-900">
            {o.customers?.name ?? "—"} — {o.seasons?.name ?? "—"}
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
            {o.status}
          </span>
        </div>
        <p className="text-sm text-gray-400">
          {o.order_number != null && <span className="font-mono text-gray-500">#{o.order_number}</span>}
          {o.order_number != null && " · "}
          {o.order_date ?? "No date"} · {o.invoice_type}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
        <OrderStatusSelector orderId={id} currentStatus={o.status} compact />
      </div>

      <OrderTabNav orderId={id} />

      {children}
    </div>
  );
}
