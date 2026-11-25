"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface R { id: string; label: string; blurb: string }

export default function LoginClient({ roles }: { roles: R[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  async function pick(id: string) {
    setBusy(id);
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: id }) });
    if (r.ok) router.push("/dashboard");
    else setBusy(null);
  }
  return (
    <div className="roles">
      {roles.map((r) => (
        <button key={r.id} className={`role c-${r.id}`} onClick={() => pick(r.id)} disabled={!!busy}>
          <div><h3>{r.label}</h3><p>{r.blurb}</p></div>
          <span className="go">{busy === r.id ? "Signing in…" : "Log in →"}</span>
        </button>
      ))}
    </div>
  );
}
