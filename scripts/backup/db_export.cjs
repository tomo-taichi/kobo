// Off-site logical DATA backup via the service-role key (bypasses RLS, reads
// every table). Schema lives in supabase/migrations/, so schema + these JSON
// files = a full restore. Output goes to data/backups/<timestamp>/ which is
// gitignored (contains customer data) and lives in Dropbox (off-machine).
//   node scripts/backup/db_export.cjs
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// All public base tables (from information_schema at backup time).
const TABLES = [
  "banks", "company_settings", "composition_options", "customer_contracts", "customer_payments",
  "customers", "list_options", "material_colors", "material_orders", "materials", "models",
  "order_document_versions", "order_documents", "order_item_sizes", "order_items", "orders",
  "product_colors", "product_images", "product_materials", "product_tags", "production_batches",
  "production_progress", "production_time_logs", "products", "profiles", "seasons", "suppliers",
];

(async () => {
  const ts = new Date().toISOString().replace(/:/g, "").replace(/\..+/, "").replace("T", "_"); // 2026-08-10_153012
  const dir = path.join("data", "backups", ts);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = { generated_at: new Date().toISOString(), source: env.NEXT_PUBLIC_SUPABASE_URL, tables: [], total_rows: 0, total_bytes: 0 };
  for (const t of TABLES) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from(t).select("*").range(from, from + 999);
      if (error) { console.error(`ERROR ${t}: ${error.message}`); process.exit(1); }
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const file = path.join(dir, `${t}.json`);
    fs.writeFileSync(file, JSON.stringify(rows));
    const bytes = fs.statSync(file).size;
    manifest.tables.push({ table: t, rows: rows.length, bytes });
    manifest.total_rows += rows.length;
    manifest.total_bytes += bytes;
    console.log(`  ${t.padEnd(24)} ${String(rows.length).padStart(6)} rows  ${String(bytes).padStart(9)} bytes`);
  }
  fs.writeFileSync(path.join(dir, "_manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ ${manifest.total_rows} rows across ${TABLES.length} tables (${(manifest.total_bytes / 1024).toFixed(1)} KB) → ${dir}`);
})();
