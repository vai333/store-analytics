import { CONFIG } from "./config";

export interface Usage { in: number; out: number }

export function costRs(u: Usage) {
  return (u.in * CONFIG.rsPerMtokIn + u.out * CONFIG.rsPerMtokOut) / 1e6;
}

/** Gemini models through OpenRouter's OpenAI-compatible chat endpoint. */
async function chat(model: string, system: string, user: string, maxTokens: number, json: boolean) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: 0,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`LLM call failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const text: string = body.choices?.[0]?.message?.content ?? "";
  const usage: Usage = { in: body.usage?.prompt_tokens ?? 0, out: body.usage?.completion_tokens ?? 0 };
  return { text, usage };
}

export async function callJson<T>(model: string, system: string, user: string, maxTokens = 900) {
  const { text, usage } = await chat(model, system, user, maxTokens, true);
  const m = text.match(/\{[\s\S]*\}/);
  try {
    return { data: m ? (JSON.parse(m[0]) as T) : null, usage, raw: text };
  } catch {
    return { data: null, usage, raw: text };
  }
}

export async function callText(model: string, system: string, user: string, maxTokens = 250) {
  const { text, usage } = await chat(model, system, user, maxTokens, false);
  return { text: text.trim(), usage };
}
