// Copies retail.db (SQLite, made by ../make_data.py) into Supabase using the secret key. Run: npm run seed
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const lite = new Database(path.join(here, "..", "..", "retail.db"), { readonly: true });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

async function copy(table, cols, keyCol, batch = 1000) {
  const { error: delErr } = await supa.from(table).delete().not(keyCol, "is", null);
  if (delErr) throw new Error(`${table}: ${delErr.message}`);
  const rows = lite.prepare(`select ${cols.join(",")} from ${table}`).all();
  for (let i = 0; i < rows.length; i += batch) {
    const { error } = await supa.from(table).insert(rows.slice(i, i + batch));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length} rows`);
}

await copy("stores", ["store_id", "store_name", "city", "region", "opened_on", "notes"], "store_id");
await copy("products", ["product_id", "product_name", "category", "mrp", "unit_cost"], "product_id");
await copy("sales", ["line_id", "order_id", "store_id", "product_id", "sale_date", "qty", "unit_price", "discount_pct", "is_return", "channel"], "line_id");
await supa.from("query_cache").delete().neq("key", "");
