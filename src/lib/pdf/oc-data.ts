import { getLang, buildPaymentTerms, type PdfLang } from "./labels";

function fmtId(raw: string | null): string {
  if (!raw) return "—";
  return raw;
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
 * Fetch + map everything the OcDocument needs. Shared by the streaming API
 * route and the "Generate & Save" server action so the layout stays in sync.
 */
export async function buildOcProps(supabase: any, orderId: string) {
  const [orderResult, itemsResult, companyResult] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number, order_date, discount_rate, deposit_rate, tax_rate, exchange_rate, customers(id, name, group_type, currency, tax_included, deposit_terms, billing_company, billing_address, billing_city, billing_postcode, billing_country), seasons(name)")
      .eq("id", orderId)
      .single(),
    supabase
      .from("order_items")
      .select("retail_price_eur, customer_wholesale_eur, products(product_number, product_category, product_sex, model_name, name, main_m_name, color), order_item_sizes(size, quantity)")
      .eq("order_id", orderId),
    supabase
      .from("company_settings")
      .select("name_ja, address_ja, nickname, phone, email")
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

  const items = (itemsResult.data ?? []).map((item: any) => ({
    category: item.products?.product_category ?? null,
    productId: fmtId(item.products?.product_number),
    sex: item.products?.product_sex ?? null,
    modelName: item.products?.model_name ?? item.products?.name ?? "—",
    materialName: item.products?.main_m_name ?? null,
    color: resolveColor(item.products),
    wholesaleEur: Number(item.customer_wholesale_eur),
    retailEur: Number(item.retail_price_eur),
    sizes: (item.order_item_sizes ?? []).map((s: any) => ({ size: s.size, quantity: s.quantity })),
    memo: null as string | null,
  }));

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
    taxRate: customer.tax_included ? 0.10 : 0,
    currency: customer.currency === "JPY" ? "JPY" : "EUR",
    exchangeRate: order.exchange_rate ? Number(order.exchange_rate) : null,
    paymentTerms,
    items,
  };
}
