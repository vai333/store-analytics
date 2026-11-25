import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isRoleId, ROLES, type Role } from "./roles";

const NAME = "sa_session";
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
};
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export function makeCookie(roleId: string) {
  return { name: NAME, value: `${roleId}.${sign(roleId)}`, httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 };
}

export function currentRole(): Role | null {
  const raw = cookies().get(NAME)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!isRoleId(id) || !sig) return null;
  const good = Buffer.from(sign(id));
  const got = Buffer.from(sig);
  return good.length === got.length && timingSafeEqual(good, got) ? ROLES[id] : null;
}

export const clearCookie = { name: NAME, value: "", path: "/", maxAge: 0 };
