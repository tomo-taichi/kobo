import { getLang, buildPaymentTerms, bankDetailLines, type PdfLang } from "./labels";

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  return raw;
}

type OcLineItem = {
  id: string;
  category: string | null;
  productId: string;
  sex: string | null;
  modelName: string;
  materialName: string | null;
  color: string | null;
  wholesaleEur: number;
  retailEur: number;
  sizes: { size: string; quantity: number }[];
  memo: string | null;
};

/**
 * Single source of truth for OC / Advance / Final money math.
 * EUR clients: everything in €. JPY clients: wholesale subtotal → ¥ (floor
 * 1,000), tax in ¥ on that basis, total = ¥ subtotal + ¥ tax. `billingTotal`
 * is the tax-inclusive total in the billing currency.
 */
export function computeOcTotals(
  items: { wholesaleEur: number; retailEur: number; sizes: { quantity: number }[] }[],
  taxRate: number,
  isJpy: boolean,
  rate: number | null,
) {
  let totalQty = 0, subtotalRetail = 0, subtotalWholesale = 0;
  for (const it of items) {
    const q = it.sizes.reduce((a, b) => a + b.quantity, 0);
    totalQty += q;
    subtotalRetail += it.retailEur * q;
    subtotalWholesale += it.wholesaleEur * q;
  }
  const floor1000 = (n: number) => Math.floor(n / 1000) * 1000;
  const taxAmount = subtotalWholesale * taxRate;
  const totalEur = subtotalWholesale + taxAmount;
  const useJpy = isJpy && rate !== null && rate > 0;
  const subWholesaleJpy = useJpy ? floor1000(subtotalWholesale * (rate as number)) : 0;
  const taxJpy = useJpy ? floor1000(subWholesaleJpy * taxRate) : 0;
  const totalJpy = subWholesaleJpy + taxJpy;
  return {
    totalQty, subtotalRetail, subtotalWholesale, taxAmount, totalEur,
    subWholesaleJpy, taxJpy, totalJpy,
    billingTotal: useJpy ? totalJpy : totalEur,
  };
}

/**
 * Resolve a product's colour. `products.color` is often null in real data;
 * the colour is then embedded as the last " / "-separated segment of `name`
 * (format: "{model} / {material} / {color}").
 */
function resolveColor(product: any): string | null {
  if (product?.color) return product.color;
  const name: string | undefined = product?.name;
  if (!name) return null;
  const parts = name.split(" / ").map((s: string) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Data for the Japanese 納品書 (Delivery Note). All prices are converted to ¥
 * (€ × season rate, whole yen). Shared by the route (preview) and save action.
 */
export async function buildDeliveryNoteProps(supabase: any, orderId: string, itemIds?: string[] | null) {
  const [orderResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_date, exchange_rate, customers(name, billing_company, tax_included), seasons(name)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("company_settings")
      .select("name_ja, address_ja, phone, email, seal_url")
      .single(),
  ]);

  const order: any = orderResult.data;
  if (!order) return null;
  const customer = order.customers ?? {};
  const cs: any = companyResult.data ?? {};

  let itemsQuery = supabase
    .from("order_items")
    .select("id, retail_price_eur, customer_wholesale_eur, products(product_category, name, model_name), order_item_sizes(size, quantity)")
    .eq("order_id", orderId)
    .order("created_at");
  // explicit selection for a saved batch; otherwise all items (preview draft)
  if (itemIds && itemIds.length > 0) itemsQuery = itemsQuery.in("id", itemIds);
  const { data: itemRows } = await itemsQuery;
  const rows = (itemRows ?? []) as any[];

  const rate = order.exchange_rate ? Number(order.exchange_rate) : 1;

  // 〒postal + address lines from the single address_ja string
  const addrParts = String(cs.address_ja ?? "").split(/\s+/).filter(Boolean);
  const addressLines = addrParts.map((p: string, i: number) => (i === 0 && /^\d{3}-?\d{4}$/.test(p) ? `〒${p}` : p));

  const items = rows.map((it: any) => ({
    category: it.products?.product_category ?? null,
    itemName: it.products?.name ?? it.products?.model_name ?? "—",
    whsleJpy: Math.round(Number(it.customer_wholesale_eur) * rate),
    retailJpy: Math.round(Number(it.retail_price_eur) * rate),
    sizes: (it.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
    memo: null as string | null,
  }));

  return {
    company: {
      nameJa: cs.name_ja || "株式会社NULLA",
      addressLines,
      phone: cs.phone ?? null,
      email: cs.email ?? null,
      sealUrl: cs.seal_url ?? null,
    },
    customerName: customer.billing_company || customer.name || "—",
    seasonName: order.seasons?.name ?? "—",
    deliveryDate: order.order_date,
    taxRate: customer.tax_included ? 0.10 : 0,
    items,
    itemRowIds: rows.map((r: any) => r.id) as string[],
  };
}

/**
 * Fetch + map everything the OcDocument needs. Shared by the streaming API
 * route and the "Generate & Save" server action so the layout stays in sync.
 */
export async function buildOcProps(supabase: any, orderId: string) {
  const [orderResult, itemsResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number, order_date, customer_id, discount_rate, deposit_rate, tax_rate, exchange_rate, deposit_amount_eur, deposit_amount_jpy, invoice_count, customers(id, name, group_type, currency, bank, tax_included, deposit_terms, billing_company, billing_address, billing_city, billing_postcode, billing_country), seasons(name)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("order_items")
      .select("id, retail_price_eur, customer_wholesale_eur, products(product_number, product_category, product_sex, model_name, name, main_m_name, color), order_item_sizes(size, quantity)")
      .eq("order_id", orderId),
    supabase
      .from("company_settings")
      .select("name_ja, address_ja, nickname, phone, email, bank_wise_eu, bank_rakuten_jp")
      .single(),
  ]);

  const order: any = orderResult.data;
  if (!order) return null;

  const customer = order.customers ?? {};
  const lang: PdfLang = getLang(customer.group_type);
  const cs: any = companyResult.data ?? {};

  const nickname = cs.nickname || "taichimurakami";
  const footerLine = [
    cs.name_ja,
    cs.address_ja,
    cs.phone ? `tel: ${cs.phone}` : null,
    cs.email ? `email: ${cs.email}` : null,
  ].filter(Boolean).join("  |  ");

  // 宛名 (addressee) = Company Name + billing address; ClientName = 通称 (customers.name)
  const customerName = customer.billing_company || customer.name || "—";
  const clientName = customer.name || null;
  const customerAddressLines = [
    customer.billing_address,
    [customer.billing_city, customer.billing_postcode].filter(Boolean).join(", "),
    customer.billing_country,
  ].filter((l: string) => l && l.length > 0);

  const customerId = customer.id ? String(customer.id).slice(0, 8) : "—";

  const hasDeposit = customer.deposit_terms === "Deposit_and_Production";
  const paymentTerms = buildPaymentTerms(
    customer.group_type,
    hasDeposit,
    Math.round(Number(order.deposit_rate) * 100),
    nickname,
  );

  const items: OcLineItem[] = (itemsResult.data ?? []).map((item: any) => ({
    id: item.id,
    category: item.products?.product_category ?? null,
    productId: fmtId(item.products?.product_number),
    sex: item.products?.product_sex ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    materialName: item.products?.main_m_name ?? null,
    color: resolveColor(item.products),
    wholesaleEur: Number(item.customer_wholesale_eur),
    retailEur: Number(item.retail_price_eur),
    sizes: (item.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
    memo: null,
  }));

  const bankDetails = bankDetailLines(customer.bank, cs.bank_wise_eu, cs.bank_rakuten_jp);

  return {
    lang,
    nickname,
    footerLine,
    orderNumber: order.order_number != null ? String(order.order_number) : orderId.slice(0, 8),
    customerName,
    clientName,
    customerAddressLines,
    customerId,
    seasonName: order.seasons?.name ?? "—",
    orderDate: order.order_date,
    discountRate: Number(order.discount_rate),
    depositRate: Number(order.deposit_rate ?? 0),
    taxRate: customer.tax_included ? 0.10 : 0,
    currency: customer.currency === "JPY" ? "JPY" : "EUR",
    exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
    paymentTerms,
    bankDetails,
    items,
    // extras for Advance / Final actions (not used by the OC render directly)
    customerIdRaw: customer.id ?? order.customer_id ?? null,
    invoiceCount: Number(order.invoice_count ?? 0),
    depositAmountEur: order.deposit_amount_eur ? Number(order.deposit_amount_eur) : null,
    depositAmountJpy: order.deposit_amount_jpy ? Number(order.deposit_amount_jpy) : null,
  };
}
