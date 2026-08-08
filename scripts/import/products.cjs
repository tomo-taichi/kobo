// FileMaker (Products.xlsx, 50 cols, 3034 rows) → Supabase products + product_colors.
//   node scripts/import/products.cjs           # dry-run (no writes)
//   node scripts/import/products.cjs --apply    # upsert on legacy_id
// Model B: group rows by (Season + Model + Main Material) → one product; each row →
// one product_color (legacy_id = FileMaker PK, for order linking).
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

const wb = XLSX.readFile("data/import/Products.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
const header = rows[0].map((h) => String(h).trim());
const ix = (n) => header.indexOf(n);
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
const num = (s) => { const t = String(s).replace(/[^0-9.\-]/g, ""); if (t === "" || t === "-") return null; const n = Number(t); return isNaN(n) ? null : n; };

async function fetchAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data: d, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    out.push(...(d ?? []));
    if (!d || d.length < 1000) break;
  }
  return out;
}

(async () => {
  const [mc, seasons] = await Promise.all([
    fetchAll("material_colors", "id, legacy_id, material_id"),
    admin.from("seasons").select("id, name, eur_jpy_rate").then((r) => r.data ?? []),
  ]);
  const mcMap = new Map(mc.map((x) => [x.legacy_id, x]));           // legacy_id → {id, material_id}
  const alias = JSON.parse(fs.readFileSync("scripts/import/material_pk_aliases.json", "utf8"));
  const resolveMat = (pk) => mcMap.get(pk) ?? (alias[pk] ? mcMap.get(alias[pk]) : undefined);
  const seasonMap = new Map(seasons.map((s) => [s.name, { id: s.id, rate: Number(s.eur_jpy_rate) || 130 }]));

  const g = (r, n) => { const i = ix(n); return i < 0 ? "" : String(r[i] ?? "").trim(); };
  const or = (...xs) => xs.find((x) => x) || null;

  // Group by (Season + Model + Main Material)
  const groups = new Map();
  for (const r of data) {
    const key = [g(r, "Season"), g(r, "Product Model code"), g(r, "Product Main Material code")].join("||");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const products = [], colors = [], pkAlias = {};
  const unmatchedSeason = new Set();
  let colorUnresolvedMat = 0, dedupedColors = 0;

  for (const [, rs] of groups) {
    const sorted = [...rs].sort((a, b) => (num(g(a, "PK_PRODUCT ID MATCH FIELD")) ?? 0) - (num(g(b, "PK_PRODUCT ID MATCH FIELD")) ?? 0));
    const rep = sorted[0];
    const legacyId = g(rep, "PK_PRODUCT ID MATCH FIELD");
    const seasonName = g(rep, "Season");
    const season = seasonMap.get(seasonName);
    if (!season) { unmatchedSeason.add(seasonName); }
    const rate = season?.rate ?? 130;

    const mainMC = resolveMat(g(rep, "FK_MATERIAL ID MATCH FIELD"));
    const liningMC = resolveMat(g(rep, "FK_Lining_MATERIAL ID"));

    // Composition (main up to 4, lining up to 3). products.*_pct is numeric.
    const comp = {};
    for (let i = 1; i <= 5; i++) {
      comp[`main_m_comp${i}_label`] = i <= 4 ? (g(rep, `main_composition${i}`) || null) : null;
      comp[`main_m_comp${i}_pct`]   = i <= 4 ? num(g(rep, `main_comp%${i}`)) : null;
      comp[`lining_m_comp${i}_label`] = i <= 3 ? (g(rep, `lining_composition${i}`) || null) : null;
      comp[`lining_m_comp${i}_pct`]   = i <= 3 ? num(g(rep, `lining_comp%${i}`)) : null;
    }

    const costJpy = num(g(rep, "T_Cost Total JP")) ?? 0;
    products.push({
      legacy_id: legacyId,
      product_number: legacyId,
      season_id: season?.id ?? null,
      model_name: g(rep, "Product Model code") || null,
      name: g(rep, "Product Model code") || "(unnamed)",
      product_category: g(rep, "Product Category") || null,
      product_sex: g(rep, "Product sex") || null,
      color: g(rep, "Product Color") || null,
      is_sample: g(rep, "IsSample") === "1",
      cleaning_instruction: or(g(rep, "cleaning")),
      weight_g: num(g(rep, "Weight")),
      hs_code: or(g(rep, "HSCODE")),
      cost_eur_rate: rate,
      // Labor cost inputs
      cutting_cost_jpy: num(g(rep, "Cost Cutting")) ?? 0,
      sewing_cost_jpy: num(g(rep, "Cost Sewing")) ?? 0,
      knitting_cost_jpy: num(g(rep, "Cost Knitting")) ?? 0,
      thread_cost_jpy: num(g(rep, "Cost Tread")) ?? 0,
      finish_cost_jpy: num(g(rep, "Cost Finish")) ?? 0,
      packing_cost_jpy: num(g(rep, "Cost Packing")) ?? 0,
      // Computed totals (from file)
      cost_jpy: costJpy,
      cost_eur: costJpy ? Math.round((costJpy / rate) * 100) / 100 : 0,
      markup_rate: num(g(rep, "T_MIN MARKUP FROM RAW COST")) ?? 3.0,
      wholesale_eur: num(g(rep, "T_EU WHOLESALE")) ?? 0,
      retail_rate: 3.5,
      retail_price_eur: num(g(rep, "T_EU RETAIL 手打ち")) ?? num(g(rep, "T_EU Retail 理論値 65% Case")) ?? 0,
      // Main material (denormalized + link)
      main_material_id: mainMC?.material_id ?? null,
      main_m_name: or(g(rep, "Product Main Material code")),
      main_m_category: or(g(rep, "Product Mat Category")),
      main_m_color: or(g(rep, "Product Color")),
      // Lining material
      lining_material_id: liningMC?.material_id ?? null,
      lining_material_color_id: liningMC?.id ?? null,
      ...comp,
    });

    // Colours: dedupe by colour; require a resolvable main material_color (NOT NULL).
    const seen = new Map();
    sorted.forEach((r, idx) => {
      const pk = g(r, "PK_PRODUCT ID MATCH FIELD");
      const color = g(r, "Product Color") || "—";
      if (seen.has(color)) { pkAlias[pk] = seen.get(color); dedupedColors++; return; }
      const cMc = resolveMat(g(r, "FK_MATERIAL ID MATCH FIELD"));
      if (!cMc) { colorUnresolvedMat++; return; } // can't create product_color without material_color_id
      seen.set(color, pk);
      const cCost = num(g(r, "T_Cost Total JP")) ?? 0;
      colors.push({
        legacy_id: pk,
        _product_legacy: legacyId,
        _color: color, // dedup only — product_colors derives its colour from material_color_id
        material_color_id: cMc.id,
        material_cost_jpy: 0,
        cost_jpy: cCost,
        cost_eur: cCost ? Math.round((cCost / rate) * 100) / 100 : 0,
        markup_rate: num(g(r, "T_MIN MARKUP FROM RAW COST")) ?? 3.0,
        wholesale_eur: num(g(r, "T_EU WHOLESALE")) ?? 0,
        retail_rate: 3.5,
        retail_price_eur: num(g(r, "T_EU RETAIL 手打ち")) ?? num(g(r, "T_EU Retail 理論値 65% Case")) ?? 0,
        sort_order: idx,
      });
    });
  }

  console.log(`\n=== Products import ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
  console.log(`File rows: ${data.length} | products: ${products.length} | product_colors: ${colors.length}`);
  console.log(`Deduped colour PKs: ${dedupedColors} | colour rows skipped (unresolved main material): ${colorUnresolvedMat}`);
  console.log(`Products with main material linked: ${products.filter((p) => p.main_material_id).length}/${products.length}`);
  console.log(`Products with lining linked: ${products.filter((p) => p.lining_material_id).length}`);
  console.log(`Unmatched seasons: ${JSON.stringify([...unmatchedSeason])}`);
  console.log(`\n--- sample product ---\n${JSON.stringify(products[0], null, 1)}`);
  console.log(`--- its colours ---\n${JSON.stringify(colors.filter((c) => c._product_legacy === products[0].legacy_id), null, 0)}`);

  if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); return; }

  for (let i = 0; i < products.length; i += 200) {
    const { error } = await admin.from("products").upsert(products.slice(i, i + 200), { onConflict: "legacy_id" });
    if (error) { console.error(`products chunk ${i}:`, error.message); process.exit(1); }
  }
  const prodRows = await fetchAll("products", "id, legacy_id");
  const prodId = new Map(prodRows.filter((p) => p.legacy_id).map((p) => [p.legacy_id, p.id]));
  const colorRecords = colors.map(({ _product_legacy, _color, ...c }) => ({ ...c, product_id: prodId.get(_product_legacy) })).filter((c) => c.product_id);
  for (let i = 0; i < colorRecords.length; i += 200) {
    const { error } = await admin.from("product_colors").upsert(colorRecords.slice(i, i + 200), { onConflict: "legacy_id" });
    if (error) { console.error(`colors chunk ${i}:`, error.message); process.exit(1); }
  }
  fs.writeFileSync("scripts/import/product_pk_aliases.json", JSON.stringify(pkAlias, null, 0));
  console.log(`\n✅ Upserted ${products.length} products + ${colorRecords.length} product_colors. Wrote ${Object.keys(pkAlias).length} PK aliases.`);
})();
