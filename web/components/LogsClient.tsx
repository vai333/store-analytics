"use client";
import { useEffect, useState } from "react";

interface Row {
  id: number; created_at: string; user_role: string; requirement: string; generated_sql: string | null; status: string;
  checker_verdict: string | null; checker_reason: string | null; crosscheck_result: string | null; rows_returned: number | null;
  cache_hit: boolean; latency_ms: number; cost_rs: string | number; model_used: string | null; assumption: string | null; clarification_turns: { question: string; answer: string }[];
}

export default function LogsClient({ isCeo }: { isCeo: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  async function load() {
    setErr("");
    const r = await fetch("/api/logs");
    if (r.status === 401) { window.location.href = "/"; return; }
    if (!r.ok) { setErr("Could not load the log."); return; }
    setRows((await r.json()).rows);
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={load}>Refresh</button>
        <span className="sub">{isCeo ? "You see every role's queries." : "You see your own queries."}</span>
      </div>
      {err && <div className="note err">{err}</div>}
      {!rows && !err && <p>Loading…</p>}
      {rows && rows.length === 0 && <p>No queries yet. Ask something on the Ask tab.</p>}
      {rows && rows.length > 0 && (
        <div className="tablewrap"><table>
          <thead><tr><th>Time</th>{isCeo && <th>Role</th>}<th>Requirement</th><th>Status</th><th>Checker</th><th>Cross-check</th><th>Rows</th><th>Cache</th><th>Latency</th><th>Cost ₹</th><th>SQL</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
              {isCeo && <td>{r.user_role}</td>}
              <td style={{ whiteSpace: "normal", minWidth: 220 }}>{r.requirement}{r.clarification_turns?.length ? <div className="sub">+{r.clarification_turns.length} clarification</div> : null}</td>
              <td><span className={`tag status-${r.status}`}>{r.status}</span></td>
              <td title={r.checker_reason ?? ""}>{r.checker_verdict ?? "–"}</td>
              <td>{r.crosscheck_result ?? "–"}</td>
              <td>{r.rows_returned ?? "–"}</td>
              <td>{r.cache_hit ? "hit" : "miss"}</td>
              <td>{(r.latency_ms / 1000).toFixed(1)}s</td>
              <td>{Number(r.cost_rs).toFixed(3)}</td>
              <td style={{ whiteSpace: "normal", minWidth: 260 }}>{r.generated_sql ? <details><summary>view</summary><pre>{r.generated_sql}</pre></details> : "–"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
