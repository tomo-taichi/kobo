// Targeted fill: materials.supplier_item_code = file "Sup item code".
// Updates ONLY supplier_item_code, matched by legacy_id (= representative/lowest PK
// per Season+Material item group, same grain as the materials import). Does NOT
// re-run the full import, so manual edits (name/price/composition) are preserved.
//   node scripts/import/materials_supplier_code.cjs           # dry-run
//   node scripts/import/materials_supplier_code.cjs --apply
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
const g = (r, n) => { const i = ix(n); return i < 0 ? "" : String(r[i] ?? "").trim(); };
const num = (s) => { const t = String(s).replace(/[^0-9.]/g, ""); if (t === "") return null; const n = Number(t); return isNaN(n) ? null : n; };

// Group by (Season + Material item), take the representative (lowest-PK) row —
// this is the material row (its PK is the material's legacy_id).
const groups = new Map();
for (const r of data) {
  const key = g(r, "Season") + " || " + g(r, "Material item");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

// legacy_id (rep PK) → supplier item code (skip groups with no code).
const codeByLegacy = new Map();
for (const [, rs] of groups) {
  const rep = [...rs].sort((a, b) => (num(g(a, "PK_MATERIAL ID MATCH FIELD")) ?? 0) - (num(g(b, "PK_MATERIAL ID MATCH FIELD")) ?? 0))[0];
  const legacyId = g(rep, "PK_MATERIAL ID MATCH FIELD");
  const code = g(rep, "Sup item code");
  if (legacyId && code) codeByLegacy.set(legacyId, code);
}

// Group legacy_ids by code so we can update with .in() (few hundred calls).
const byCode = new Map();
for (const [legacyId, code] of codeByLegacy) {
  if (!byCode.has(code)) byCode.set(code, []);
  byCode.get(code).push(legacyId);
}

console.log(`\n=== Supplier item code fill ${APPLY ? "(APPLY)" : "(DRY-RUN)"} ===`);
console.log(`Materials (groups): ${groups.size} | with a supplier code: ${codeByLegacy.size} | distinct codes: ${byCode.size}`);
const samples = [...codeByLegacy.entries()].slice(0, 6).map(([lid, c]) => `${lid}→${c}`);
console.log(`Sample: ${samples.join(", ")}`);

if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); process.exit(0); }

(async () => {
  let updated = 0;
  for (const [code, legacyIds] of byCode) {
    for (let i = 0; i < legacyIds.length; i += 200) {
      const chunk = legacyIds.slice(i, i + 200);
      const { error, count } = await admin
        .from("materials")
        .update({ supplier_item_code: code }, { count: "exact" })
        .in("legacy_id", chunk);
      if (error) { console.error("materials:", error.message); process.exit(1); }
      updated += count ?? 0;
    }
  }
  console.log(`\n✅ Set supplier_item_code on ${updated} materials.`);
})();
