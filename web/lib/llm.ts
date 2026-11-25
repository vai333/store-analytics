import { CONFIG } from "./config";

export interface Usage { in: number; out: number }

export function costRs(u: Usage) {
  return (u.in * CONFIG.rsPerMtokIn + u.out * CONFIG.rsPerMtokOut) / 1e6;
}

/** Google's Gemini API (generateContent). The key goes in a header, never in the URL. */
async function generateOnce(model: string, system: string, user: string, maxTokens: number, json: boolean) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      // Extra room: Gemini 2.5 models spend part of this budget on internal reasoning.
      generationConfig: { temperature: 0, maxOutputTokens: maxTokens + 2048, ...(json ? { responseMimeType: "application/json" } : {}) },
    }),
  });
  if (!res.ok) throw Object.assign(new Error(`LLM call failed (${res.status}): ${(await res.text()).slice(0, 200)}`), { status: res.status });
  const body = await res.json();
  const text: string = (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const usage: Usage = { in: body.usageMetadata?.promptTokenCount ?? 0, out: (body.usageMetadata?.candidatesTokenCount ?? 0) + (body.usageMetadata?.thoughtsTokenCount ?? 0) };
  return { text, usage };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries a busy model (429/5xx) with a short backoff, then tries the fallback model. */
async function generate(model: string, system: string, user: string, maxTokens: number, json: boolean) {
  let last: unknown;
  // If one tier is busy, the other tier can still answer.
  const other = model === CONFIG.modelBig ? CONFIG.modelSmall : CONFIG.modelBig;
  for (const m of other === model ? [model] : [model, other]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await generateOnce(m, system, user, maxTokens, json);
      } catch (e) {
        last = e;
        const status = (e as { status?: number }).status;
        if (status && status !== 429 && status < 500) throw e; // a real error, not a busy model
        await wait(500 * 2 ** attempt);
      }
    }
  }
  throw last;
}

export async function callJson<T>(model: string, system: string, user: string, maxTokens = 900) {
  const { text, usage } = await generate(model, system, user, maxTokens, true);
  const m = text.match(/\{[\s\S]*\}/);
  try {
    return { data: m ? (JSON.parse(m[0]) as T) : null, usage, raw: text };
  } catch {
    return { data: null, usage, raw: text };
  }
}

export async function callText(model: string, system: string, user: string, maxTokens = 250) {
  const { text, usage } = await generate(model, system, user, maxTokens, false);
  return { text: text.trim(), usage };
}
