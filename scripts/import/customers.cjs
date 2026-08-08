// FileMaker (Customers_01.xlsx, 67 cols) → Supabase customers import.
//   node scripts/import/customers.cjs           # dry-run (no writes) — prints a report
//   node scripts/import/customers.cjs --apply    # upsert on legacy_id
// Deletion of existing data is done separately (SQL), on purpose.
const XLSX = require("xlsx");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const SRC = "data/import/Customers_01.xlsx";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const wb = XLSX.readFile(SRC);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
const header = rows[0].map((h) => String(h).trim());
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
const idx = (name) => header.indexOf(name);

const FWD = new Set(["EMS", "FedEx", "UPS", "DHL", "TNT"]);
const BANK_KEY = {
  "WISE EU": "WISE_EU", "RAKUTEN JP": "Rakuten_JP", "WISE USD": "WISE_USD",
  "RAKUTEN EU": "RAKUTEN_EU", "個人": "KOJIN", "会社": "KAISHA",
};

function toRecord(r) {
  const g = (name) => { const i = idx(name); return i < 0 ? "" : String(r[i] ?? "").trim(); };
  const or = (...xs) => xs.find((x) => x) || null;

  const cur = g("Currency");
  const currency = cur === "¥" ? "JPY" : "EUR"; // € and £ → EUR
  const customer_type = g("Group") === "Personal" ? "B2C" : "B2B";

  // Billing (fall back to the Company address when billing is blank).
  const billing_company  = or(g("Billing Company"), g("Company"));
  const billing_address  = or(g("Billing Address 1"));
  const billing_city     = or(g("Billing City"), g("Company City"));
  const billing_state    = or(g("Billing State"), g("Company State"));
  const billing_postcode = or(g("Billing Postal"), g("Company Postal"));
  const billing_country  = or(g("Billing Country"), g("Company Country"));
  const billing_tel      = or(g("Billing Phone"), g("Office Phone 1"));
  const billing_email    = or(g("Email 1"), g("Office Email 1"));

  // Shipping — the "Duplicate Address Shipping" flag says where it comes from.
  const dupShip = g("Duplicate Address Shipping");
  const shop = (n) => ({
    shipping_name:     or(g(`Shop name ${n}`)),
    shipping_address:  or(g(`Shop Address ${n}`)),
    shipping_city:     or(g(`Shop City ${n}`)),
    shipping_state:    or(g(`Shop State ${n}`)),
    shipping_postcode: or(g(`Shop Postal ${n}`)),
    shipping_country:  or(g(`Shop Country ${n}`)),
    shipping_tel:      or(g(`Shop Phone ${n}`)),
    shipping_email:    null,
    shipping_fax:      null,
  });
  let shipping_same = false;
  let ship;
  if (dupShip === "Company Address" || dupShip === "") {
    shipping_same = true; // inherit billing
    ship = {
      shipping_name: billing_company, shipping_address: billing_address, shipping_city: billing_city,
      shipping_state: billing_state, shipping_postcode: billing_postcode, shipping_country: billing_country,
      shipping_tel: billing_tel, shipping_email: billing_email, shipping_fax: or(g("Fax")),
    };
  } else if (dupShip === "Shop 1 Address") {
    ship = shop(1);
  } else if (dupShip === "Shop 2 Address") {
    ship = shop(2);
  } else { // "NEW"
    ship = {
      shipping_name: or(g("Shipping Name")), shipping_address: null, shipping_city: or(g("City Shipping")),
      shipping_state: or(g("State Shipping")), shipping_postcode: or(g("Postal Code Shipping")),
      shipping_country: or(g("Country Shipping")), shipping_tel: or(g("Shipping Phone")),
      shipping_email: or(g("Shipping Email")), shipping_fax: or(g("Shipping Fax")),
    };
  }

  // Forwarder: enum match only; keep the raw method in the shipping memo otherwise.
  const method = g("Shipping_Method");
  const forwarder = FWD.has(method) ? method : null;
  const memoLines = [g("Shipping memo"), method && !forwarder ? `Method: ${method}` : ""].filter(Boolean);

  // Contacts (people) — up to 3.
  const contacts = [];
  for (let i = 1; i <= 3; i++) {
    const c = {
      name: or(g(`Name ${i}`)), jobTitle: or(g(`Job Title ${i}`)),
      email: or(g(`Email ${i}`), g(`Office Email ${i}`)),
      mobile: or(g(`Mobile Phone ${i}`)), phone: or(g(`Office Phone ${i}`)),
    };
    if (c.name || c.email || c.mobile || c.phone || c.jobTitle) contacts.push(c);
  }

  // Shops — {name, address} (combined) to stay compatible with the current form.
  const shops = [];
  for (let n = 1; n <= 2; n++) {
    const name = g(`Shop name ${n}`);
    const addr = [g(`Shop Address ${n}`), g(`Shop City ${n}`), g(`Shop State ${n}`), g(`Shop Postal ${n}`), g(`Shop Country ${n}`), g(`Shop Phone ${n}`) ? `Tel: ${g(`Shop Phone ${n}`)}` : ""].filter(Boolean).join(", ");
    if (name || addr) shops.push({ name: name || "", address: addr });
  }

  const sns = g("Instagram") ? [{ platform: "Instagram", url: g("Instagram") }] : [];

  return {
    legacy_id: or(g("PK_CUSTOMER ID MATCH FIELD")),
    name: g("Company"),
    customer_type,
    currency,
    language: (billing_country === "Japan") ? "ja" : "en",
    bank: BANK_KEY[g("Bank")] || null,
    tax_included: g("Tax") === "Yes",
    deposit_terms: g("Deposit term") === "Deposit & Production" ? "Deposit_and_Production" : "Production_Only",
    payment_terms: or(g("Payment term")),
    shipping_terms: or(g("Shipping_Term")),
    website: or(g("Website")),
    billing_company, billing_address, billing_city, billing_state, billing_postcode, billing_country,
    billing_tel, billing_email, billing_vat: or(g("TAX ID Memo")), billing_fax: or(g("Fax")),
    shipping_same, ...ship,
    shipping_memo: memoLines.length ? memoLines.join("\n") : null,
    forwarder, forwarder_account: or(g("shipping Account no.")),
    contacts, shops, sns,
  };
}

const records = data.map(toRecord);

// ---- report ----
const dist = (key) => records.reduce((m, r) => ((m[r[key] ?? "∅"] = (m[r[key] ?? "∅"] || 0) + 1), m), {});
const missingName = records.filter((r) => !r.name);
const missingLegacy = records.filter((r) => !r.legacy_id);
const dupLegacy = records.length - new Set(records.map((r) => r.legacy_id)).size;
const withContacts = records.filter((r) => r.contacts.length).length;
const totalContacts = records.reduce((a, r) => a + r.contacts.length, 0);
const withShops = records.filter((r) => r.shops.length).length;
const unknownBank = [...new Set(data.map((r) => String(r[idx("Bank")] ?? "").trim()).filter(Boolean).filter((b) => !BANK_KEY[b]))];

console.log(`\n=== Customers import ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
console.log(`Parsed:            ${records.length}`);
console.log(`Missing name:      ${missingName.length} | missing legacy_id: ${missingLegacy.length} | dup legacy_id: ${dupLegacy}`);
console.log(`customer_type:     ${JSON.stringify(dist("customer_type"))}`);
console.log(`currency:          ${JSON.stringify(dist("currency"))}`);
console.log(`deposit_terms:     ${JSON.stringify(dist("deposit_terms"))}`);
console.log(`language:          ${JSON.stringify(dist("language"))}`);
console.log(`bank:              ${JSON.stringify(dist("bank"))}`);
console.log(`contacts:          ${withContacts} customers have contacts (${totalContacts} people total)`);
console.log(`shops:             ${withShops} customers have shops`);
console.log(`unmapped bank vals:${unknownBank.length ? " " + JSON.stringify(unknownBank) : " none"}`);
console.log(`\n--- sample record ---\n${JSON.stringify(records[0], null, 2)}`);

if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply to upsert.`); process.exit(0); }
if (missingName.length || missingLegacy.length || dupLegacy) { console.error("\nRefusing to apply: fix name/legacy_id issues first."); process.exit(1); }

(async () => {
  let done = 0;
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    const { error } = await admin.from("customers").upsert(chunk, { onConflict: "legacy_id" });
    if (error) { console.error(`Chunk ${i} failed:`, error.message); process.exit(1); }
    done += chunk.length;
  }
  console.log(`\n✅ Upserted ${done} customers.`);
})();
