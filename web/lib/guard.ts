import sqlp from "node-sql-parser";
import type { Table } from "./roles.ts";

const parser = new (sqlp as unknown as typeof import("node-sql-parser")).Parser();
const DENY = /\b(pg_[a-z_]+|current_setting|set_config|dblink|lo_[a-z]+|copy|into\s+outfile|information_schema|pg_catalog)\b/i;

export interface GuardResult {
  ok: boolean;
  reason?: string;
  sql?: string;
  tables?: string[];
}

/** Code-level guard: one read-only SELECT that touches only the tables in `allowed`. */
export function guardSql(raw: string, allowed: readonly Table[], maxRows: number): GuardResult {
  const sql = raw.trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, reason: "Empty query." };
  if (sql.includes(";")) return { ok: false, reason: "Only one statement is allowed." };
  if (DENY.test(sql)) return { ok: false, reason: "Query uses a function or schema that is not allowed." };

  let ast;
  try {
    ast = parser.astify(sql, { database: "postgresql" });
  } catch (e) {
    return { ok: false, reason: `SQL did not parse: ${(e as Error).message.slice(0, 160)}` };
  }
  const stmts = Array.isArray(ast) ? ast : [ast];
  if (stmts.length !== 1 || stmts[0].type !== "select") return { ok: false, reason: "Only a single SELECT is allowed." };

  const ctes = new Set<string>(
    ((stmts[0] as { with?: { name: { value: string } }[] }).with ?? []).map((w) => String(w.name.value).toLowerCase()),
  );
  const used = parser
    .tableList(sql, { database: "postgresql" })
    .map((t) => t.split("::").pop()!.toLowerCase())
    .filter((t) => !ctes.has(t));
  const bad = used.filter((t) => !(allowed as readonly string[]).includes(t));
  if (bad.length) return { ok: false, reason: `Not allowed for this role: ${[...new Set(bad)].join(", ")}.`, tables: used };

  return { ok: true, sql: `select * from (${sql}) as q limit ${maxRows}`, tables: used };
}
