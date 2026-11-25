import { NextResponse } from "next/server";
import { readLogs } from "@/lib/logger";
import { currentRole } from "@/lib/session";

export async function GET() {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  // Each role sees its own log. The CEO sees all.
  return NextResponse.json({ rows: await readLogs(role.id, role.id === "ceo") });
}
