// FileMaker "Manufacturing Cost_01.xlsx" → each product's manufacturing TIME + cost.
// The file gives per-step JPY costs; at ¥2000/hour the time is cost ÷ 2000 (hours),
// stored as *_minutes = hours × 60. Also recomputes each product/colour cost stack
// (cost_jpy = material + manufacturing → cost_eur → Ideal WS) using stored material
// costs, EUR rate and markup. Markup and adopted retail price are left unchanged.
//   node scripts/import/manufacturing_cost.cjs           # dry-run
//   node scripts/import/manufacturing_cost.cjs --apply
const XLSX = require("xlsx");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const LABOR_RATE = 2000; // ¥ / hour
const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// file column → our step key
const STEP_COL = {
  cutting: "Cost Cutting", sewing: "Cost Sewing", knitting: "Cost Knitting",
  thread: "Cost Tread", finish: "Cost Finish", packing: "Cost Packing",
};
const STEPS = Object.keys(STEP_COL);
const num = (s) => { const t = String(s).replace(/[^0-9.]/g, ""); if (t === "") return 0; const n = Number(t); return isNaN(n) ? 0 : n; };
const r2 = (n) => Math.round(n * 100) / 100;

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
  const wb = XLSX.readFile("data/import/Manufacturing Cost_01.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  const header = rows[0].map((h) => String(h).trim());
  const ix = (n) => header.indexOf(n);
  const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
  const g = (r, n) => { const i = ix(n); return i < 0 ? "" : String(r[i] ?? "").trim(); };

  const [products, pc, pcAll] = await Promise.all([
    fetchAll("products", "id, legacy_id, cost_eur_rate, markup_rate, cost_jpy, cost_eur, cutting_cost_jpy, sewing_cost_jpy, knitting_cost_jpy, thread_cost_jpy, finish_cost_jpy, packing_cost_jpy"),
    fetchAll("product_colors", "legacy_id, product_id"),
    fetchAll("product_colors", "id, product_id, cost_jpy, cost_eur, markup_rate"),
  ]);
  const prodById = new Map(products.map((p) => [p.id, p]));
  const pcMap = new Map(pc.filter((x) => x.legacy_id).map((x) => [x.legacy_id, x.product_id]));
  const prodAlias = JSON.parse(fs.readFileSync("scripts/import/product_pk_aliases.json", "utf8"));
  const prodLegacy = new Map(products.filter((p) => p.legacy_id).map((p) => [p.legacy_id, p.id]));
  const resolveProduct = (pk) => pcMap.get(pk) ?? (prodAlias[pk] ? pcMap.get(prodAlias[pk]) : undefined) ?? prodLegacy.get(pk);
  const colorsByProduct = new Map();
  for (const c of pcAll) { if (!colorsByProduct.has(c.product_id)) colorsByProduct.set(c.product_id, []); colorsByProduct.get(c.product_id).push(c); }

  // Resolve manufacturing costs per product (dedupe the file's per-colour rows).
  const mfgByProduct = new Map(); // product_id → { steps:{k:cost}, total }
  let unresolved = 0, conflicts = 0;
  for (const r of data) {
    const pid = resolveProduct(g(r, "PK_PRODUCT ID MATCH FIELD"));
    if (!pid) { unresolved++; continue; }
    const steps = {}; let total = 0;
    for (const k of STEPS) { const c = num(g(r, STEP_COL[k])); steps[k] = c; total += c; }
    const prev = mfgByProduct.get(pid);
    if (prev) { if (Math.round(prev.total) !== Math.round(total)) conflicts++; continue; } // keep first
    mfgByProduct.set(pid, { steps, total });
  }

  // Build the update payloads.
  const prodUpdates = [], colorUpdates = [];
  let totalMinutes = 0;
  for (const [pid, mfg] of mfgByProduct) {
    const p = prodById.get(pid);
    if (!p) continue;
    const oldMfg = STEPS.reduce((s, k) => s + Number(p[`${k}_cost_jpy`] ?? 0), 0);
    // Product-level EUR rate: derive from stored base, else the product rate, else 130.
    const baseRate = (Number(p.cost_jpy) > 0 && Number(p.cost_eur) > 0) ? Number(p.cost_jpy) / Number(p.cost_eur)
      : (Number(p.cost_eur_rate) > 0 ? Number(p.cost_eur_rate) : 130);

    const minutes = {}; const costs = {};
    for (const k of STEPS) { costs[k] = mfg.steps[k]; minutes[k] = r2((mfg.steps[k] / LABOR_RATE) * 60); totalMinutes += minutes[k]; }

    // Base product: material = old cost_jpy − old mfg; new total = material + new mfg.
    const baseMaterial = Math.max(0, Number(p.cost_jpy ?? 0) - oldMfg);
    const baseCostJpy = baseMaterial + mfg.total;
    const baseCostEur = r2(baseCostJpy / baseRate);
    const baseWholesale = r2(baseCostEur * Number(p.markup_rate ?? 3));
    prodUpdates.push({
      id: pid,
      cutting_minutes: minutes.cutting, sewing_minutes: minutes.sewing, knitting_minutes: minutes.knitting,
      thread_minutes: minutes.thread, finish_minutes: minutes.finish, packing_minutes: minutes.packing,
      cutting_cost_jpy: costs.cutting, sewing_cost_jpy: costs.sewing, knitting_cost_jpy: costs.knitting,
      thread_cost_jpy: costs.thread, finish_cost_jpy: costs.finish, packing_cost_jpy: costs.packing,
      material_cost_jpy: r2(baseMaterial), cost_jpy: r2(baseCostJpy), cost_eur: baseCostEur, wholesale_eur: baseWholesale,
    });

    for (const c of (colorsByProduct.get(pid) ?? [])) {
      const rate = (Number(c.cost_jpy) > 0 && Number(c.cost_eur) > 0) ? Number(c.cost_jpy) / Number(c.cost_eur) : baseRate;
      const material = Math.max(0, Number(c.cost_jpy ?? 0) - oldMfg);
      const costJpy = material + mfg.total;
      const costEur = r2(costJpy / rate);
      const wholesale = r2(costEur * Number(c.markup_rate ?? 3));
      colorUpdates.push({ id: c.id, material_cost_jpy: r2(material), cost_jpy: r2(costJpy), cost_eur: costEur, wholesale_eur: wholesale });
    }
  }

  console.log(`\n=== Manufacturing cost import ${APPLY ? "(APPLY)" : "(DRY-RUN)"} — ¥${LABOR_RATE}/hr ===`);
  console.log(`File rows: ${data.length} | products resolved: ${mfgByProduct.size} | unresolved: ${unresolved} | mfg conflicts (kept first): ${conflicts}`);
  console.log(`Product updates: ${prodUpdates.length} | colour updates: ${colorUpdates.length}`);
  // Sample
  const sp = prodUpdates[0];
  if (sp) {
    console.log(`\n--- sample product ${sp.id} ---`);
    console.log(`minutes: cut ${sp.cutting_minutes} / sew ${sp.sewing_minutes} / knit ${sp.knitting_minutes} / thread ${sp.thread_minutes} / fin ${sp.finish_minutes} / pack ${sp.packing_minutes}`);
    console.log(`step ¥: ${JSON.stringify({ cut: sp.cutting_cost_jpy, sew: sp.sewing_cost_jpy, knit: sp.knitting_cost_jpy, thread: sp.thread_cost_jpy, fin: sp.finish_cost_jpy, pack: sp.packing_cost_jpy })}`);
    console.log(`material ¥${sp.material_cost_jpy} + mfg → cost ¥${sp.cost_jpy} → €${sp.cost_eur} → Ideal WS €${sp.wholesale_eur}`);
  }

  if (!APPLY) { console.log(`\nDry-run only. Re-run with --apply.`); return; }

  const runBatched = async (table, updates) => {
    let done = 0;
    for (let i = 0; i < updates.length; i += 20) {
      const chunk = updates.slice(i, i + 20);
      const res = await Promise.all(chunk.map(({ id, ...fields }) => admin.from(table).update(fields).eq("id", id)));
      const err = res.find((r) => r.error);
      if (err) { console.error(table, err.error.message); process.exit(1); }
      done += chunk.length;
      if (done % 500 === 0) console.log(`  ${table}: ${done}/${updates.length}`);
    }
  };
  await runBatched("products", prodUpdates);
  await runBatched("product_colors", colorUpdates);
  console.log(`\n✅ Updated ${prodUpdates.length} products + ${colorUpdates.length} product_colors (manufacturing time/cost + recomputed totals).`);
})();
