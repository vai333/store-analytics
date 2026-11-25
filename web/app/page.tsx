import { redirect } from "next/navigation";
import LoginClient from "@/components/LoginClient";
import { ROLE_LIST } from "@/lib/roles";
import { currentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Login() {
  if (currentRole()) redirect("/dashboard");
  return (
    <main className="wrap">
      <div className="top"><span className="brand"><span className="dot" />Store Analytics</span></div>
      <section className="hero">
        <div className="sticker">read-only<br />&amp; logged</div>
        <h1 className="display">Ask your data.<br />Get a number <span className="serif acc">you can trust.</span></h1>
        <p className="lede" style={{ marginTop: 28 }}>Chat with your data in plain English. Pick who you are to start.</p>
        <LoginClient roles={ROLE_LIST.map(({ id, label, blurb }) => ({ id, label, blurb }))} />
      </section>
    </main>
  );
}
