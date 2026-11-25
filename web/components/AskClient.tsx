"use client";
import { useEffect, useRef, useState } from "react";

type Turn = { question: string; answer: string };
type Answered = { status: "answered"; columns: string[]; rows: (string | number | null)[][]; summary: string; assumption: string; sql: string; cacheHit: boolean; crosscheck: string; latencyMs: number };
type Out = Answered | { status: "clarifying"; question: string } | { status: "out_of_scope" | "rejected" | "blocked" | "failed"; message: string };
type Msg = { from: "user"; text: string } | { from: "bot"; out: Out };

const SUGGEST: Record<string, string[]> = {
  ceo: ["What were net sales last month?", "Which store had the highest net sales this year?", "Top 5 products by margin"],
  sales_head: ["Net sales by channel last month", "What is the return rate this year?", "Units sold per month"],
  product_head: ["Which products have the lowest margin?", "List products by category with MRP", "Average unit cost per category"],
  store_head: ["Which stores are in the West region?", "List stores by city", "Which store opened most recently?"],
};

export default function AskClient({ roleId }: { roleId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null); // clarifying question waiting for an answer
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function send(question: string, history: Turn[]) {
    setBusy(true);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, turns: history, mode: "text" }) });
      if (r.status === 401) { window.location.href = "/"; return; }
      const out: Out = await r.json();
      setMsgs((m) => [...m, { from: "bot", out }]);
      setPending(out.status === "clarifying" ? out.question : null);
    } catch {
      setMsgs((m) => [...m, { from: "bot", out: { status: "failed", message: "Could not reach the server. Please try again." } }]);
    } finally { setBusy(false); }
  }

  function submit(override?: string) {
    const t = (override ?? text).trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setText("");
    if (pending) {
      const next = [...turns, { question: pending, answer: t }];
      setTurns(next); setPending(null);
      send(original, next);
    } else {
      setOriginal(t); setTurns([]);
      send(t, []);
    }
  }

  return (
    <div className="chat">
      <div className="thread" aria-live="polite">
        {msgs.length === 0 && (
          <div className="empty">
            <p className="sub">Try one of these, or type your own.</p>
            <div className="chips">{(SUGGEST[roleId] ?? []).map((s) => <button key={s} className="chip" onClick={() => submit(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.from === "user"
          ? <div key={i} className="bubble me">{m.text}</div>
          : <div key={i} className="bubble bot"><Bot out={m.out} /></div>)}
        {busy && <div className="bubble bot"><span className="spin" /> Working on it…</div>}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={2} aria-label="Your message"
          placeholder={pending ? "Type your answer…" : "Ask about your data, e.g. “net sales last month by region”"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="btn" onClick={() => submit()} disabled={busy || !text.trim()}>{pending ? "Answer" : "Send"}</button>
      </div>
    </div>
  );
}

function Bot({ out }: { out: Out }) {
  if (out.status === "clarifying") return <><strong>Quick question</strong><p style={{ margin: "6px 0 0" }}>{out.question}</p></>;
  if (out.status !== "answered") return <p style={{ margin: 0 }} className={out.status === "out_of_scope" ? "" : "bad"}>{out.message}</p>;
  const single = out.rows.length === 1 && out.rows[0].length === 1;
  return (
    <div>
      {single && <div className="big">{fmt(out.rows[0][0])}</div>}
      <p style={{ margin: "0 0 10px" }}>{out.summary}</p>
      <div className="meta">
        {out.assumption && <span className="tag">Assumption: {out.assumption}</span>}
        <span className={`tag ${out.crosscheck === "match" || out.crosscheck === "cached" ? "ok" : "warn"}`}>Cross-check: {out.crosscheck}</span>
        <span className="tag">{out.cacheHit ? "From cache" : "Fresh"} · {(out.latencyMs / 1000).toFixed(1)}s</span>
        <span className="tag">{out.rows.length} row{out.rows.length === 1 ? "" : "s"}</span>
      </div>
      {!single && out.rows.length > 0 && (
        <div className="tablewrap"><table>
          <thead><tr>{out.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{out.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{fmt(v)}</td>)}</tr>)}</tbody>
        </table></div>
      )}
      <details><summary>SQL that ran</summary><pre>{out.sql}</pre></details>
    </div>
  );
}

function fmt(v: string | number | null) {
  if (v === null) return "–";
  const s = String(v);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : s;
}
