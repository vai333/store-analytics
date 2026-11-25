import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./roles";
import { CONFIG } from "./config";

let client: SupabaseClient | null = null;

/** Server-side client using the Supabase secret key. Never import this into client components. */
export function supa() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

/**
 * Runs an already-guarded SELECT through the `run_readonly` database function, which switches to the
 * role's database user (read-only, with a timeout) before running it. See supabase/functions.sql.
 */
export async function runAsRole(role: Role, sql: string): Promise<QueryResult> {
  const { data, error } = await supa().rpc("run_readonly", { p_role: role.dbRole, p_sql: sql, p_timeout_ms: CONFIG.queryTimeoutMs });
  if (error) throw new Error(`Query failed: ${error.message}`);
  const objs = (data ?? []) as Record<string, unknown>[];
  const columns = objs.length ? Object.keys(objs[0]) : [];
  return { columns, rows: objs.map((o) => columns.map((c) => norm(o[c]))) };
}

function norm(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string") return v;
  return String(v);
}
