// ADR-0011 Phase 1 backfill — DRY-RUN by default (no writes).
// Groups existing products into Models by (model_name, category); within each Model,
// each distinct "recipe signature" (non-main materials incl. lining + orderable sizes
// + accessory composition) becomes a frozen Model Version (start_season = earliest
// season it appears). Products link to their matching version. Main material, mfg,
// tags, prices stay on the Product.
//   node scripts/import/model_backfill.cjs            # dry-run (+ sample)
//   node scripts/import/model_backfill.cjs --apply    # (not used yet)
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function fetchAll(t, c) { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await admin.from(t).select(c).range(f, f + 999); if (error) { console.error(t, error.message); process.exit(1); } o.push(...(data ?? [])); if (!data || data.length < 1000) break; } return o; }

const r3 = (x) => Math.round(Number(x || 0) * 1000) / 1000;
// Chronological sort key from a season name (YY.1/YY.2 and legacy YYSS/YYAW; ALLSS/委託 = base 0).
function seasonKey(name) {
  if (!name) return 0;
  let m = name.match(/^(\d{2})\.(1|2)$/); if (m) return (2000 + +m[1]) * 10 + +m[2];
  m = name.match(/^(\d{2})(SS|AW)$/i); if (m) return (2000 + +m[1]) * 10 + (m[2].toUpperCase() === "AW" ? 2 : 1);
  return 0; // ALLSS, 委託, unparseable → base
}

(async () => {
  const [products, pms, seasons, materials, matColors, ptags] = await Promise.all([
    fetchAll("products", "id, product_number, model_name, product_category, season_id, main_material_id, main_m_name, lining_material_id, lining_material_color_id, lining_m_quantity, orderable_sizes, accessory_composition, cutting_minutes, sewing_minutes, knitting_minutes, thread_minutes, finish_minutes, packing_minutes"),
    fetchAll("product_materials", "product_id, material_group, material_id, material_color_id, usage_amount"),
    fetchAll("seasons", "id, name"),
    fetchAll("materials", "id, name"),
    fetchAll("material_colors", "id, color, material_id"),
    fetchAll("product_tags", "product_id, tag"),
  ]);
  const seasonName = new Map(seasons.map((s) => [s.id, s.name]));
  const matName = new Map(materials.map((m) => [m.id, m.name]));
  const mcInfo = new Map(matColors.map((c) => [c.id, c]));
  const pmByProduct = new Map(); for (const pm of pms) { if (!pmByProduct.has(pm.product_id)) pmByProduct.set(pm.product_id, []); pmByProduct.get(pm.product_id).push(pm); }
  const tagsByProduct = new Map(); for (const t of ptags) { if (!tagsByProduct.has(t.product_id)) tagsByProduct.set(t.product_id, []); tagsByProduct.get(t.product_id).push(t.tag); }

  // Human-readable material label for a (material_id, material_color_id) pair.
  const label = (matId, mcId) => {
    if (mcId && mcInfo.has(mcId)) { const c = mcInfo.get(mcId); return `${matName.get(c.material_id) ?? "?"} / ${c.color}`; }
    return matName.get(matId) ?? "?";
  };

  // Non-main materials for a product: lining (from product) + product_materials rows.
  function recipeMaterials(p) {
    const rows = [];
    if (p.lining_material_id) rows.push({ role: "lining", material_id: p.lining_material_id, material_color_id: p.lining_material_color_id, usage: r3(p.lining_m_quantity) });
    for (const pm of (pmByProduct.get(p.id) ?? [])) rows.push({ role: pm.material_group, material_id: pm.material_id, material_color_id: pm.material_color_id, usage: r3(pm.usage_amount) });
    return rows;
  }
  function signature(p) {
    const mats = recipeMaterials(p).map((m) => [m.role, m.material_color_id || ("M:" + m.material_id), m.usage]).sort();
    const sizes = [...(p.orderable_sizes ?? [])].sort();
    return JSON.stringify({ mats, sizes, ac: p.accessory_composition ?? null });
  }

  // Group into Models by (trimmed name, category).
  const models = new Map();
  for (const p of products) {
    const name = (p.model_name ?? "").trim(); const cat = p.product_category ?? "";
    const key = name + "||" + cat;
    if (!models.has(key)) models.set(key, { name, category: cat, products: [] });
    models.get(key).products.push(p);
  }

  // Per model → versions by distinct signature (start_season = earliest); detect conflicts.
  let totalVersions = 0, totalMvmRows = 0, conflicts = [];
  const modelList = [];
  for (const [, m] of models) {
    const bySig = new Map();
    for (const p of m.products) {
      const s = signature(p);
      if (!bySig.has(s)) bySig.set(s, { products: [], startKey: Infinity, startSeason: null, startSeasonId: null, rep: null });
      const v = bySig.get(s); v.products.push(p);
      const k = seasonKey(seasonName.get(p.season_id));
      if (k < v.startKey) { v.startKey = k; v.startSeason = seasonName.get(p.season_id); v.startSeasonId = p.season_id; v.rep = p; }
    }
    // conflict: a season maps to >1 signature within this model
    const seasonSigs = new Map();
    for (const p of m.products) { const sn = seasonName.get(p.season_id) ?? "?"; if (!seasonSigs.has(sn)) seasonSigs.set(sn, new Set()); seasonSigs.get(sn).add(signature(p)); }
    for (const [sn, set] of seasonSigs) if (set.size > 1) conflicts.push(`${m.name} [${m.category}] @ ${sn}: ${set.size} recipes`);
    const versions = [...bySig.values()].sort((a, b) => a.startKey - b.startKey);
    versions.forEach((v) => { totalVersions++; totalMvmRows += recipeMaterials(v.products[0]).length; });
    modelList.push({ ...m, versions });
  }

  const vc = modelList.map((m) => m.versions.length);
  console.log(`\n=== Model backfill ${APPLY ? "(APPLY)" : "(DRY-RUN — no writes)"} ===`);
  console.log(`Products: ${products.length} | Models (name,category): ${models.size} | Versions (distinct recipe): ${totalVersions}`);
  console.log(`Versions/model: 1=${vc.filter((n) => n === 1).length}, 2=${vc.filter((n) => n === 2).length}, 3+=${vc.filter((n) => n >= 3).length}, max=${Math.max(...vc)}`);
  console.log(`model_version_materials rows to create: ${totalMvmRows} | conflicts (same model+season, >1 recipe): ${conflicts.length}`);
  if (conflicts.length) console.log(`  e.g. ${conflicts.slice(0, 6).join(" | ")}`);
  const totalLinks = modelList.reduce((a, m) => a + m.versions.reduce((b, v) => b + v.products.length, 0), 0);
  console.log(`product links (model_version_id) to set: ${totalLinks} | model_tags: 0 (left empty by decision)`);

  // ── Sample with real names ──
  const SAMPLE = ["MOUNTAIN PARKA", "JEAN JACKET", "JEANS", "SWEAT PARKA", "STAND FALL IN COLLAR COAT"];
  const fmtId = (n) => (n ? String(n) : "—");
  console.log(`\n=========== SAMPLE (real product names) ===========`);
  let shownProducts = 0;
  for (const wanted of SAMPLE) {
    const m = modelList.find((x) => x.name.toUpperCase() === wanted);
    if (!m) continue;
    console.log(`\n■ Model: "${m.name}"  [category: ${m.category}]  — ${m.products.length} products → ${m.versions.length} version(s)`);
    m.versions.forEach((v, i) => {
      const rep = v.products[0];
      const mats = recipeMaterials(rep).map((x) => `${x.role}: ${label(x.material_id, x.material_color_id)} ×${x.usage}`);
      const seasonsUsed = [...new Set(v.products.map((p) => seasonName.get(p.season_id)))].join(", ");
      console.log(`   └ v${i + 1}  start_season=${v.startSeason}  status=frozen  (${v.products.length} products; seasons: ${seasonsUsed})`);
      console.log(`       shared recipe → sizes:[${(rep.orderable_sizes ?? []).join(",")}]  accessory:${rep.accessory_composition ?? "—"}`);
      console.log(`       non-main materials: ${mats.length ? mats.join("  |  ") : "(none)"}`);
      v.products.slice(0, 2).forEach((p) => {
        console.log(`         · product ${fmtId(p.product_number)}  "${p.model_name}"  season=${seasonName.get(p.season_id)}  → stays on product: main="${p.main_m_name ?? "—"}", mfg(min) sew=${r3(p.sewing_minutes)}, tags=[${(tagsByProduct.get(p.id) ?? []).join(",")}]`);
        shownProducts++;
      });
    });
  }
  console.log(`\n(sample products shown: ${shownProducts})`);
  if (!APPLY) { console.log(`\nDry-run only. Nothing written.`); return; }

  // ── APPLY ──
  const { count: mvCount } = await admin.from("model_versions").select("*", { count: "exact", head: true });
  if ((mvCount ?? 0) > 0) { console.error(`\nABORT: model_versions already has ${mvCount} rows (backfill already ran?). No changes made.`); process.exit(1); }

  // 1) Models (upsert on unique(name, category))
  const modelRows = modelList.map((m) => ({ name: m.name, category: m.category }));
  for (let i = 0; i < modelRows.length; i += 200) {
    const { error } = await admin.from("models").upsert(modelRows.slice(i, i + 200), { onConflict: "name,category" });
    if (error) { console.error("models upsert:", error.message); process.exit(1); }
  }
  const allModels = await fetchAll("models", "id, name, category");
  const modelId = new Map(allModels.map((m) => [m.name + "||" + m.category, m.id]));

  // 2) Versions per model (single insert per model → RETURNING preserves input order) + ids
  let vInserted = 0; const mvmRows = []; const prodUpdates = [];
  for (const m of modelList) {
    const mid = modelId.get(m.name + "||" + m.category);
    if (!mid) { console.error("missing model id:", m.name, m.category); process.exit(1); }
    const rows = m.versions.map((v) => {
      const rep = v.rep;
      return {
        model_id: mid, season_id: v.startSeasonId, status: "frozen",
        changelog: "Backfilled from existing product history",
        orderable_sizes: rep.orderable_sizes ?? [], accessory_composition: rep.accessory_composition ?? null,
        cutting_minutes: r3(rep.cutting_minutes), sewing_minutes: r3(rep.sewing_minutes), knitting_minutes: r3(rep.knitting_minutes),
        thread_minutes: r3(rep.thread_minutes), finish_minutes: r3(rep.finish_minutes), packing_minutes: r3(rep.packing_minutes),
      };
    });
    const { data, error } = await admin.from("model_versions").insert(rows).select("id");
    if (error) { console.error("model_versions insert:", error.message); process.exit(1); }
    m.versions.forEach((v, i) => {
      v.id = data[i].id; vInserted++;
      recipeMaterials(v.rep).forEach((x, si) => mvmRows.push({ model_version_id: v.id, role: x.role, material_id: x.material_id, material_color_id: x.material_color_id, usage_amount: x.usage, sort_order: si }));
      prodUpdates.push({ ids: v.products.map((p) => p.id), version_id: v.id, model_id: mid });
    });
  }

  // 3) model_version_materials
  for (let i = 0; i < mvmRows.length; i += 200) {
    const { error } = await admin.from("model_version_materials").insert(mvmRows.slice(i, i + 200));
    if (error) { console.error("mvm insert:", error.message); process.exit(1); }
  }

  // 4) product links (model_version_id + model_id)
  let linked = 0;
  for (const u of prodUpdates) {
    for (let i = 0; i < u.ids.length; i += 200) {
      const chunk = u.ids.slice(i, i + 200);
      const { error } = await admin.from("products").update({ model_version_id: u.version_id, model_id: u.model_id }).in("id", chunk);
      if (error) { console.error("product link:", error.message); process.exit(1); }
      linked += chunk.length;
    }
  }

  console.log(`\n✅ APPLIED: models=${allModels.length}, versions=${vInserted}, model_version_materials=${mvmRows.length}, product links=${linked}`);
})();
