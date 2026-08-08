// Targeted fix: SET ¥ = file "Unit Price per m" (UNIT ¥ stays = "Cost"/current).
// Updates ONLY set_price_jpy on materials + material_colors, matched by legacy_id.
// Does NOT re-run the full import (so the manual supplier fix is preserved).
//   node scripts/import/materials_setprice.cjs           # dry-run
//   node scripts/import/materials_setprice.cjs --apply
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

const wb = XLSX.readFile("data/import/Materials_01.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
const header = rows[0].map((h) => String(h).trim());
const ix = (n) => header.indexOf(n);
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
const num = (s) => { const t = String(s).replace(/[^0-9.]/g, ""); if (t === "") return null; const n = Number(t); return isNaN(n) ? null : n; };

// PK (legacy_id) → SET ¥ value ("Unit Price per m"). Skip rows with no value.
const priceByPk = new Map();
for (const r of data) {
  const pk = String(r[ix("PK_MATERIAL ID MATCH FIELD")] ?? "").trim();
  const setPrice = num(r[ix("Unit Price per m")]);
  if (pk && setPrice != null) priceByPk.set(pk, setPrice);
}

// Group PKs by price so we can update with .in() (few hundred calls, not thousands).
const byPrice = new Map();
for (const [pk, price] of priceByPk) {
  if (!byPrice.has(price)) byPrice.set(price, []);
  byPrice.get(price).push(pk);
}

console.log(`\n=== Set ¥ update ${APPLY ? "(APPLY)" : "(DRY-RUN)"} ===`);
console.log(`Rows with a Set ¥ value: ${priceByPk.size} | distinct prices: ${byPrice.size}`);
console.log(`Sample: PK 9 → ${priceByPk.get("9")}, PK 10 → ${priceByPk.get("10")}`);

if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); process.exit(0); }

(async () => {
  let mc = 0, mat = 0;
  for (const [price, pks] of byPrice) {
    for (let i = 0; i < pks.length; i += 200) {
      const chunk = pks.slice(i, i + 200);
      const r1 = await admin.from("material_colors").update({ set_price_jpy: price }).in("legacy_id", chunk);
      if (r1.error) { console.error("material_colors:", r1.error.message); process.exit(1); }
      const r2 = await admin.from("materials").update({ set_price_jpy: price }).in("legacy_id", chunk);
      if (r2.error) { console.error("materials:", r2.error.message); process.exit(1); }
    }
    mc += pks.length;
  }
  console.log(`\n✅ Updated set_price_jpy for ${mc} colour PKs (material_colors + matching materials).`);
})();
