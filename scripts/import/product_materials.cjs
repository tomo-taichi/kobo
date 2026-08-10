// FileMaker Product_materials_01.xlsx → product_materials (5 additional roles) +
// products.main_m_quantity / lining_m_quantity. Main/Lining LINKS are left as the
// products import set them; this only fills quantities + the additional-material rows.
//   node scripts/import/product_materials.cjs           # dry-run (no writes)
//   node scripts/import/product_materials.cjs --apply
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

// Map the file's (EN+JP) "Material group" labels → our role keys / main / lining.
const GROUP_MAP = {
  "Main": "main",
  "Lining": "lining",
  "見頃裏地": "lining",              // body lining
  "袖裏地": "sleeve_lining",         // sleeve lining
  "ポケットスレキ手前布": "pocket_facing",
  "ポケットスレキ向布": "pocket_bag",
  "芯地": "interfacing",             // interfacing
  "付属": "accessories",             // attachments/accessories
  "Accessory": "accessories",
  "Other": "accessories",            // catch-all (⚠ confirm)
};
const ADDITIONAL_ROLES = new Set(["sleeve_lining", "pocket_facing", "pocket_bag", "interfacing", "accessories"]);

const num = (s) => { const t = String(s).replace(/[^0-9.]/g, ""); if (t === "") return null; const n = Number(t); return isNaN(n) ? null : n; };

async function fetchAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) { console.error(table, error.message); process.exit(1); }
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

(async () => {
  const wb = XLSX.readFile("data/import/Product_materials_01.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  const header = rows[0].map((h) => String(h).trim());
  const ix = (n) => header.indexOf(n);
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  const g = (r, n) => { const i = ix(n); return i < 0 ? "" : String(r[i] ?? "").trim(); };

  const [products, mc, pc, materials, seasons] = await Promise.all([
    fetchAll("products", "id, legacy_id, main_material_id, lining_material_id"),
    fetchAll("material_colors", "id, legacy_id, material_id"),
    fetchAll("product_colors", "legacy_id, product_id"),
    fetchAll("materials", "id, legacy_id, name, season_id, material_number"),
    fetchAll("seasons", "id, name"),
  ]);
  const prodById = new Map(products.map((p) => [p.id, p]));
  // FK_PRODUCT is a FileMaker product-COLOUR row PK. Products were grouped, so resolve
  // via product_colors.legacy_id → product_id (+ PK aliases), falling back to the
  // representative products.legacy_id for colour-rows the products import skipped.
  const pcMap = new Map(pc.filter((x) => x.legacy_id).map((x) => [x.legacy_id, x.product_id]));
  const prodAlias = JSON.parse(fs.readFileSync("scripts/import/product_pk_aliases.json", "utf8"));
  const prodLegacy = new Map(products.filter((p) => p.legacy_id).map((p) => [p.legacy_id, p.id]));
  const resolveProduct = (pk) => pcMap.get(pk) ?? (prodAlias[pk] ? pcMap.get(prodAlias[pk]) : undefined) ?? prodLegacy.get(pk);

  const mcMap = new Map(mc.map((x) => [x.legacy_id, x])); // material colour PK → {id, material_id}
  const alias = JSON.parse(fs.readFileSync("scripts/import/material_pk_aliases.json", "utf8"));
  const seasonByName = new Map(seasons.map((s) => [s.name, s.id]));
  const matByName = new Map(); // name(lower) → [material]
  for (const m of materials) { const k = (m.name || "").toLowerCase().trim(); if (!k) continue; if (!matByName.has(k)) matByName.set(k, []); matByName.get(k).push(m); }
  // FK_MATERIAL → {material_id, color_id}. Primary: material-colour PK (+ alias) → exact colour.
  // Fallback: material NAME (+ product season to disambiguate) → material-level (colour null).
  function resolveMat(pk, name, seasonName) {
    const exact = mcMap.get(pk) ?? (alias[pk] ? mcMap.get(alias[pk]) : undefined);
    if (exact) return { material_id: exact.material_id, color_id: exact.id };
    const cands = matByName.get((name || "").toLowerCase().trim());
    if (!cands || cands.length === 0) return undefined;
    let pick = cands.length === 1 ? cands[0] : null;
    if (!pick) { const sid = seasonByName.get(seasonName); const inSeason = cands.filter((c) => c.season_id === sid); if (inSeason.length === 1) pick = inSeason[0]; }
    // Last resort for a still-ambiguous name: the representative = smallest material_number
    // (near-duplicate materials across seasons, e.g. "tyvek soft/hard").
    if (!pick) pick = [...cands].sort((a, b) => (Number(a.material_number) || 1e9) - (Number(b.material_number) || 1e9))[0];
    return pick ? { material_id: pick.id, color_id: null } : undefined;
  }

  const unknownGroups = {};
  const otherSamples = [];
  let unresolvedProduct = 0, unresolvedMaterial = 0;
  const roleCounts = {};
  const pmRows = [];                    // additional-material rows to insert
  const pmDedup = new Map();            // (product|material|role) → row (collapse per-colour repeats)
  const mainQty = new Map();            // productId → qty (matching current main link if possible)
  const liningQty = new Map();

  for (const r of data) {
    const groupRaw = g(r, "Material group");
    const target = GROUP_MAP[groupRaw];
    if (!target) { unknownGroups[groupRaw || "(blank)"] = (unknownGroups[groupRaw || "(blank)"] || 0) + 1; continue; }
    if (groupRaw === "Other" && otherSamples.length < 8) otherSamples.push({ mat: g(r, "Product Material item"), cat: g(r, "Materials::Material Category"), qty: g(r, "Qty") });

    const productId = resolveProduct(g(r, "FK_PRODUCT ID MATCH FIELD"));
    if (!productId) { unresolvedProduct++; continue; }
    const prod = prodById.get(productId);
    const matPk = g(r, "FK_MATERIAL ID MATCH FIELD");
    const resolved = resolveMat(matPk, g(r, "Product Material item"), g(r, "Products::Season"));
    if (!resolved) { unresolvedMaterial++; continue; }
    const q0 = num(g(r, "Qty")) ?? 0; // usage_amount is NOT NULL — empty Qty → 0
    roleCounts[target] = (roleCounts[target] || 0) + 1;

    if (target === "main") {
      const match = resolved.material_id === prod?.main_material_id;
      if (match || !mainQty.has(productId)) mainQty.set(productId, q0);
    } else if (target === "lining") {
      const match = resolved.material_id === prod?.lining_material_id;
      if (match || !liningQty.has(productId)) liningQty.set(productId, q0);
    } else if (ADDITIONAL_ROLES.has(target)) {
      // Same material repeats across a product's colour-rows — dedupe by
      // (product, material, role); keep the first real Qty over a 0.
      const key = productId + "|" + resolved.material_id + "|" + target;
      const existing = pmDedup.get(key);
      if (existing) { if ((existing.usage_amount ?? 0) === 0 && q0 > 0) existing.usage_amount = q0; continue; }
      const row = { product_id: productId, material_id: resolved.material_id, material_color_id: resolved.color_id, material_group: target, usage_amount: q0 };
      pmDedup.set(key, row);
      pmRows.push(row);
    }
  }

  const byRole = {};
  for (const r of pmRows) byRole[r.material_group] = (byRole[r.material_group] || 0) + 1;

  console.log(`\n=== Product materials import ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
  console.log(`File rows: ${data.length}`);
  console.log(`Unresolved product (FK_PRODUCT not in DB): ${unresolvedProduct}`);
  console.log(`Unresolved material (FK_MATERIAL not resolvable): ${unresolvedMaterial}`);
  console.log(`Unknown Material group labels: ${JSON.stringify(unknownGroups)}`);
  console.log(`Mapped role counts (resolved rows): ${JSON.stringify(roleCounts)}`);
  console.log(`\nproduct_materials rows to INSERT: ${pmRows.length}  by role: ${JSON.stringify(byRole)}`);
  console.log(`Main quantities to set: ${mainQty.size} products | Lining quantities: ${liningQty.size} products`);
  console.log(`\n"Other"→accessories sample (⚠ confirm mapping): ${JSON.stringify(otherSamples, null, 0)}`);
  console.log(`\n--- sample product_materials rows ---\n${JSON.stringify(pmRows.slice(0, 4), null, 0)}`);

  if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); return; }

  // Idempotent: product_materials has no natural key → clear the additional-role rows
  // for the products in this file, then insert fresh.
  const productIds = [...new Set(pmRows.map((r) => r.product_id))];
  for (let i = 0; i < productIds.length; i += 200) {
    const { error } = await admin.from("product_materials").delete().in("product_id", productIds.slice(i, i + 200));
    if (error) { console.error("clear pm:", error.message); process.exit(1); }
  }
  for (let i = 0; i < pmRows.length; i += 200) {
    const { error } = await admin.from("product_materials").insert(pmRows.slice(i, i + 200));
    if (error) { console.error("insert pm:", error.message); process.exit(1); }
  }
  // Main / Lining quantities (grouped by value → few .in() calls).
  const setQty = async (map, col) => {
    const byVal = new Map();
    for (const [pid, q] of map) { const k = String(q); if (!byVal.has(k)) byVal.set(k, []); byVal.get(k).push(pid); }
    for (const [k, ids] of byVal) {
      const val = k === "null" ? null : Number(k);
      for (let i = 0; i < ids.length; i += 200) {
        const { error } = await admin.from("products").update({ [col]: val }).in("id", ids.slice(i, i + 200));
        if (error) { console.error(col, error.message); process.exit(1); }
      }
    }
  };
  await setQty(mainQty, "main_m_quantity");
  await setQty(liningQty, "lining_m_quantity");

  console.log(`\n✅ Inserted ${pmRows.length} product_materials + set main qty(${mainQty.size}) / lining qty(${liningQty.size}).`);
})();
