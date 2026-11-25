import { NextResponse } from "next/server";
import { ask } from "@/lib/pipeline";
import { currentRole } from "@/lib/session";

export const maxDuration = 30;

export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, 500);
  if (!question) return NextResponse.json({ error: "Empty question" }, { status: 400 });
  const turns = Array.isArray(body.turns)
    ? body.turns.slice(0, 4).map((t: { question?: unknown; answer?: unknown }) => ({ question: String(t.question ?? "").slice(0, 300), answer: String(t.answer ?? "").slice(0, 300) }))
    : [];
  return NextResponse.json(await ask({ role, question, turns, mode: body.mode === "voice" ? "voice" : "text" }));
}
