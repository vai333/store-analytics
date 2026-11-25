import { createHash } from "node:crypto";
import { CONFIG } from "./config";
import { supa, type QueryResult } from "./db";
import type { Role } from "./roles";

export interface CachedAnswer extends QueryResult {
  sql: string; summary: string; assumption: string;
}

export const normalise = (q: string) => q.toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "").trim();

/** Key = question + scope. The scope is the role and its tables, so roles never share entries. */
export function cacheKey(role: Role, question: string, clarifications: string[]) {
  const scope = `${role.id}:${role.tables.join(",")}`;
  return createHash("sha256").update([scope, normalise(question), ...clarifications.map(normalise)].join("|")).digest("hex");
}

/** A hit refreshes the 2 hour window (it runs from the most recent search). Atomic, in SQL. */
export async function cacheGet(key: string, role: Role): Promise<CachedAnswer | null> {
  const { data, error } = await supa().rpc("cache_touch", { p_key: key, p_role: role.id, p_ttl_seconds: CONFIG.cacheTtlSeconds });
  if (error || !data || !(data as unknown[]).length) return null;
  const r = (data as Record<string, unknown>[])[0];
  return { sql: r.sql as string, rows: r.result as QueryResult["rows"], columns: r.columns as string[], summary: r.summary as string, assumption: (r.assumption as string) ?? "" };
}

export async function cachePut(key: string, role: Role, question: string, a: CachedAnswer) {
  await supa().from("query_cache").upsert({
    key, role: role.id, question, sql: a.sql, result: a.rows, summary: a.summary, assumption: a.assumption, columns: a.columns,
    created_at: new Date().toISOString(), last_hit_at: new Date().toISOString(), hit_count: 0,
    expires_at: new Date(Date.now() + CONFIG.cacheTtlSeconds * 1000).toISOString(),
  });
}

export async function cachePurge() {
  await supa().from("query_cache").delete().lt("expires_at", new Date().toISOString());
}
