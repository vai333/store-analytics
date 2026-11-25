import { supa } from "./db";

export interface LogRow {
  user_role: string; requirement: string; input_mode?: string; clarification_turns?: unknown[];
  generated_sql?: string | null; checker_verdict?: string | null; checker_reason?: string | null;
  crosscheck_result?: string | null; rows_returned?: number | null; assumption?: string | null;
  model_used?: string | null; cache_hit?: boolean; latency_ms?: number; tokens_in?: number;
  tokens_out?: number; cost_rs?: number;
  status: "answered" | "out_of_scope" | "blocked" | "rejected" | "failed" | "clarifying";
}

/** Logs questions, SQL and row counts. Never the returned rows themselves. */
export async function writeLog(l: LogRow) {
  try {
    const { error } = await supa().from("query_log").insert({ ...l, input_mode: l.input_mode ?? "text", clarification_turns: l.clarification_turns ?? [] });
    if (error) console.error("log write failed", error.message);
  } catch (e) {
    console.error("log write failed", (e as Error).message); // logging must never break an answer
  }
}

export async function readLogs(role: string, isCeo: boolean, limit = 100) {
  let q = supa().from("query_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (!isCeo) q = q.eq("user_role", role);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}
