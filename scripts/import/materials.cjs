// FileMaker (Materials_01.xlsx, 26 cols, 1033 rows) → Supabase materials + material_colors.
//   node scripts/import/materials.cjs           # dry-run (no writes)
//   node scripts/import/materials.cjs --apply    # upsert on legacy_id
// Model B (normalized): group rows by (Season + Material item) → one material;
// each row → one material_color (legacy_id = FileMaker PK, for product linking).
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
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
const ix = (n) => header.indexOf(n);

const num = (s) => { const t = String(s).replace(/[^0-9.]/g, ""); if (t === "") return null; const n = Number(t); return isNaN(n) ? null : n; };
const intN = (s) => { const n = num(s); return n == null ? null : Math.round(n); }; // comp_N_pct is integer
const unitType = (widthlabel) => (widthlabel === "ds" ? "ds" : widthlabel === "" ? "piece" : "meter");

(async () => {
  // Resolve season & supplier names → ids
  const [{ data: seasons }, { data: suppliers }] = await Promise.all([
    admin.from("seasons").select("id, name"),
    admin.from("suppliers").select("id, name"),
  ]);
  const seasonMap = new Map((seasons ?? []).map((s) => [s.name, s.id]));
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.name, s.id]));

  const g = (r, n) => { const i = ix(n); return i < 0 ? "" : String(r[i] ?? "").trim(); };

  // Group by (Season + Material item)
  const groups = new Map();
  for (const r of data) {
    const key = g(r, "Season") + " || " + g(r, "Material item");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const unmatchedSeason = new Set();
  const unmatchedSupplier = new Set();
  const materials = [];
  const colors = [];
  const pkAlias = {}; // dropped material PK → kept material_color legacy_id

  for (const [, rs] of groups) {
    // Representative row = lowest PK
    const sorted = [...rs].sort((a, b) => (num(g(a, "PK_MATERIAL ID MATCH FIELD")) ?? 0) - (num(g(b, "PK_MATERIAL ID MATCH FIELD")) ?? 0));
    const rep = sorted[0];
    const legacyId = g(rep, "PK_MATERIAL ID MATCH FIELD");
    const seasonName = g(rep, "Season");
    const supplierName = g(rep, "Supplier");
    const seasonId = seasonMap.get(seasonName) ?? null;
    const supplierId = supplierName ? (supplierMap.get(supplierName) ?? null) : null;
    if (seasonName && !seasonId) unmatchedSeason.add(seasonName);
    if (supplierName && !supplierId) unmatchedSupplier.add(supplierName);

    const comp = {};
    for (let i = 1; i <= 5; i++) {
      comp[`comp_${i}_label`] = g(rep, `Composition${i}`) || null;
      comp[`comp_${i}_pct`] = intN(g(rep, `comp_rate${i}`));
    }

    const noteLines = [];
    if (g(rep, "Width")) noteLines.push(`Width: ${g(rep, "Width")}${g(rep, "widthlabel") || ""}`);
    if (g(rep, "Height")) noteLines.push(`Height: ${g(rep, "Height")}`);
    if (g(rep, "Memo")) noteLines.push(g(rep, "Memo"));

    materials.push({
      legacy_id: legacyId,
      material_number: legacyId,
      name: g(rep, "Material item"),
      category: g(rep, "Material Category"),
      unit_type: unitType(g(rep, "widthlabel")),
      season_id: seasonId,
      supplier_id: supplierId,
      supplier_item_code: g(rep, "Sup item code") || null, // supplier's own code for this material
      color: g(rep, "Color") || null, // legacy single-colour field
      unit_price_jpy: num(g(rep, "Unit Price per m")) ?? num(g(rep, "Cost")) ?? 0,
      set_price_jpy: 0,
      notes: noteLines.length ? noteLines.join("\n") : null,
      ...comp,
    });

    // Dedupe colours within a material by colour name (schema is unique on
    // (material_id, color)). Keep the lowest-PK row; record dropped PK → kept PK
    // so Products can still resolve references to the dropped rows.
    const seenColor = new Map(); // color → kept PK
    sorted.forEach((r, idx) => {
      const pk = g(r, "PK_MATERIAL ID MATCH FIELD");
      const color = g(r, "Color") || "—";
      if (seenColor.has(color)) {
        pkAlias[pk] = seenColor.get(color);
        return;
      }
      seenColor.set(color, pk);
      colors.push({
        legacy_id: pk,
        _material_legacy: legacyId,
        color,
        unit_price_jpy: num(g(r, "Unit Price per m")) ?? num(g(r, "Cost")),
        set_price_jpy: null,
        sort_order: idx,
      });
    });
  }

  console.log(`\n=== Materials import ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
  console.log(`File rows: ${data.length} | materials (groups): ${materials.length} | material_colors: ${colors.length} | deduped colour PKs: ${Object.keys(pkAlias).length}`);
  console.log(`Seasons resolved: ${new Set(materials.map((m)=>m.season_id).filter(Boolean)).size} | unmatched season names: ${JSON.stringify([...unmatchedSeason])}`);
  console.log(`Suppliers resolved: ${materials.filter((m)=>m.supplier_id).length}/${materials.length} | unmatched suppliers: ${unmatchedSupplier.size}${unmatchedSupplier.size?" "+JSON.stringify([...unmatchedSupplier].slice(0,10)):""}`);
  const cat = materials.reduce((m,x)=>((m[x.category]=(m[x.category]||0)+1),m),{});
  const ut = materials.reduce((m,x)=>((m[x.unit_type]=(m[x.unit_type]||0)+1),m),{});
  console.log(`category: ${JSON.stringify(cat)}`);
  console.log(`unit_type: ${JSON.stringify(ut)}`);
  console.log(`\n--- sample material ---\n${JSON.stringify(materials[0], null, 1)}`);
  console.log(`--- its colours ---\n${JSON.stringify(colors.filter(c=>c._material_legacy===materials[0].legacy_id), null, 0)}`);

  if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); return; }

  // Upsert materials
  for (let i = 0; i < materials.length; i += 200) {
    const { error } = await admin.from("materials").upsert(materials.slice(i, i + 200), { onConflict: "legacy_id" });
    if (error) { console.error(`materials chunk ${i}:`, error.message); process.exit(1); }
  }
  // Resolve material ids
  const { data: matRows } = await admin.from("materials").select("id, legacy_id").not("legacy_id", "is", null);
  const matId = new Map((matRows ?? []).map((m) => [m.legacy_id, m.id]));
  const colorRecords = colors.map(({ _material_legacy, ...c }) => ({ ...c, material_id: matId.get(_material_legacy) })).filter((c) => c.material_id);
  for (let i = 0; i < colorRecords.length; i += 200) {
    const { error } = await admin.from("material_colors").upsert(colorRecords.slice(i, i + 200), { onConflict: "legacy_id" });
    if (error) { console.error(`colors chunk ${i}:`, error.message); process.exit(1); }
  }
  // Persist PK aliases so the Products import can resolve dropped material PKs.
  fs.writeFileSync("scripts/import/material_pk_aliases.json", JSON.stringify(pkAlias, null, 0));
  console.log(`\n✅ Upserted ${materials.length} materials + ${colorRecords.length} material_colors. Wrote ${Object.keys(pkAlias).length} PK aliases.`);
})();
