import { NextResponse } from "next/server";
import { isRoleId } from "@/lib/roles";
import { clearCookie, makeCookie } from "@/lib/session";

export async function POST(req: Request) {
  const { role } = await req.json().catch(() => ({}));
  if (!isRoleId(role)) return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(makeCookie(role));
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearCookie);
  return res;
}
