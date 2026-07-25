import type { SupabaseClient } from "@supabase/supabase-js";

// ADR-0009 Phase 2 — Purchase Order (発注書) data.
// Materials are ordered per supplier: one PO groups all order lines (order_qty > 0)
// whose material belongs to that supplier, for one season. No persistence — the PO
// is generated on demand from the saved order quantities in material_orders.

export type PurchaseOrderRow = {
  materialName: string;
  colour: string;
  orderQty: number;
  unitType: string;
  notes: string | null;
};

export type PurchaseOrderData = {
  company: {
    name: string;
    address: string;
    phone: string | null;
    email: string | null;
    registrationNo: string | null;
    nickname: string | null;
  };
  supplier: {
    id: string;
    name: string;
    address: string | null;
    personName: string | null;
    email: string | null;
  };
  seasonName: string;
  rows: PurchaseOrderRow[];
};

export async function buildPurchaseOrderData(
  supabase: SupabaseClient,
  seasonId: string,
  supplierId: string
): Promise<PurchaseOrderData | null> {
  const [seasonRes, companyRes, supplierRes, moRes] = await Promise.all([
    supabase.from("seasons").select("name").eq("id", seasonId).single(),
    supabase
      .from("company_settings")
      .select("name_ja, name_en, address_ja, address_en, phone, email, registration_no, nickname")
      .limit(1)
      .single(),
    supabase
      .from("suppliers")
      .select("id, name, address, primary_name, primary_email")
      .eq("id", supplierId)
      .single(),
    supabase
      .from("material_orders")
      .select("order_qty, notes, material_colors(color), materials(name, unit_type, supplier_id)")
      .eq("season_id", seasonId)
      .gt("order_qty", 0),
  ]);

  if (!seasonRes.data || !supplierRes.data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = companyRes.data ?? {};
  const rows: PurchaseOrderRow[] = ((moRes.data ?? []) as any[])
    .filter((mo) => mo.materials?.supplier_id === supplierId)
    .map((mo) => ({
      materialName: mo.materials?.name ?? "—",
      colour: mo.material_colors?.color ?? "—",
      orderQty: Number(mo.order_qty ?? 0),
      unitType: mo.materials?.unit_type ?? "",
      notes: mo.notes ?? null,
    }))
    .sort((a, b) => a.materialName.localeCompare(b.materialName, "ja") || a.colour.localeCompare(b.colour));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = supplierRes.data;
  return {
    company: {
      name: c.name_ja || c.name_en || "",
      address: c.address_ja || c.address_en || "",
      phone: c.phone ?? null,
      email: c.email ?? null,
      registrationNo: c.registration_no ?? null,
      nickname: c.nickname ?? null,
    },
    supplier: {
      id: s.id,
      name: s.name,
      address: s.address ?? null,
      personName: s.primary_name ?? null,
      email: s.primary_email ?? null,
    },
    seasonName: (seasonRes.data as { name: string }).name,
    rows,
  };
}

// Japanese fabric-order email template (mailto). Pure — no I/O, so it is unit-testable.
export function buildOrderEmail(args: {
  seasonName: string;
  personName: string | null;
  companyName: string;
  companyAddress: string;
  companyPhone: string | null;
  companyEmail: string | null;
  rows: PurchaseOrderRow[];
}): { subject: string; body: string } {
  const { seasonName, personName, companyName, companyAddress, companyPhone, companyEmail, rows } = args;
  const subject = `【${seasonName}】生地発注のお願い`;
  const lines = rows.map((r) => `・${r.materialName}（${r.colour}）：${r.orderQty} ${r.unitType}`.trimEnd());
  const body = [
    personName ? `${personName} 様` : "ご担当者様",
    "",
    "いつもお世話になっております。",
    "下記の通り発注をお願いいたします。",
    "",
    ...lines,
    "",
    "以上、よろしくお願いいたします。",
    "",
    companyName,
    companyAddress,
    companyPhone ? `TEL: ${companyPhone}` : "",
    companyEmail ?? "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === "")) // collapse consecutive blank lines
    .join("\n");
  return { subject, body };
}
