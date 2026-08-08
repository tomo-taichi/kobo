// FileMaker (Suppliers_01.xlsx, 18 cols) → Supabase suppliers.
//   node scripts/import/suppliers.cjs           # dry-run (no writes)
//   node scripts/import/suppliers.cjs --apply    # upsert on legacy_id
const XLSX = require("xlsx");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const wb = XLSX.readFile("data/import/Suppliers_01.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
const header = rows[0].map((h) => String(h).trim());
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
const idx = (name) => header.indexOf(name);

function toRecord(r) {
  const g = (name) => { const i = idx(name); return i < 0 ? "" : String(r[i] ?? "").trim(); };
  const or = (...xs) => xs.find((x) => x) || null;

  const country = or(g("Country"));
  // Japanese suppliers: postal-first JP format 〒NNN-NNNN 都道府県市区町村… (no commas).
  // Others: Western order, comma-separated.
  let address;
  if (country === "Japan") {
    const line = [g("State"), g("City"), g("Address 1"), g("Address 2")].filter(Boolean).join("");
    const postal = g("Postal");
    address = [postal ? `〒${postal}` : "", line].filter(Boolean).join(" ") || null;
  } else {
    address = [g("Address 1"), g("Address 2"), g("City"), g("State"), g("Postal")].filter(Boolean).join(", ") || null;
  }
  const primary_name = or(g("Contact Person"), [g("First"), g("Last")].filter(Boolean).join(" "));

  const noteLines = [];
  if (g("Fax")) noteLines.push(`Fax: ${g("Fax")}`);
  const cpEmail = g("Contact Person EMAIL");
  const primary_email = or(g("Office Email 1"), cpEmail);
  if (cpEmail && cpEmail !== primary_email) noteLines.push(`Contact email: ${cpEmail}`);

  return {
    legacy_id: or(g("PK_SUPPLIER ID MATCH FIELD")),
    name: g("Supplier"),
    contact: primary_name,
    address,
    country,
    company_phone: or(g("Office Phone 1")),
    primary_name,
    primary_title: or(g("Job Title")),
    primary_mobile: or(g("Office Phone 2")),
    primary_email,
    secondary_email: or(g("Office Email 2")),
    notes: noteLines.length ? noteLines.join("\n") : null,
  };
}

const records = data.map(toRecord);
const missingName = records.filter((r) => !r.name);
const missingLegacy = records.filter((r) => !r.legacy_id);
const dupLegacy = records.length - new Set(records.map((r) => r.legacy_id)).size;
const dist = (k) => records.reduce((m, r) => ((m[r[k] ?? "∅"] = (m[r[k] ?? "∅"] || 0) + 1), m), {});
const withPrimary = records.filter((r) => r.primary_name).length;
const withEmail = records.filter((r) => r.primary_email).length;

console.log(`\n=== Suppliers import ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
console.log(`Parsed:          ${records.length}`);
console.log(`Missing name:    ${missingName.length} | missing legacy_id: ${missingLegacy.length} | dup legacy_id: ${dupLegacy}`);
console.log(`country:         ${JSON.stringify(dist("country"))}`);
console.log(`with primary_name: ${withPrimary} | with primary_email: ${withEmail}`);
console.log(`\n--- sample records ---`);
for (const r of records.slice(0, 3)) console.log(JSON.stringify(r));

if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply to upsert.`); process.exit(0); }
if (missingName.length || missingLegacy.length || dupLegacy) { console.error("\nRefusing to apply: fix name/legacy_id issues first."); process.exit(1); }

(async () => {
  let done = 0;
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    const { error } = await admin.from("suppliers").upsert(chunk, { onConflict: "legacy_id" });
    if (error) { console.error(`Chunk ${i} failed:`, error.message); process.exit(1); }
    done += chunk.length;
  }
  console.log(`\n✅ Upserted ${done} suppliers.`);
})();
