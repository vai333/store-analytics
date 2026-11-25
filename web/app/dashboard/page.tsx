import { redirect } from "next/navigation";
import AskClient from "@/components/AskClient";
import Header from "@/components/Header";
import { currentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const role = currentRole();
  if (!role) redirect("/");
  return (
    <>
      <Header roleLabel={role.label} />
      <main className="wrap page">
        <h1 className="display" style={{ fontSize: "clamp(2.4rem,6vw,4.5rem)", marginBottom: 12 }}>What do you want <span className="serif" style={{ color: "var(--blue)" }}>to know?</span></h1>
        <p className="sub" style={{ marginTop: 0, marginBottom: 24 }}>Signed in as {role.label}. You can query: {role.tables.join(", ")}.</p>
        <AskClient roleId={role.id} />
      </main>
    </>
  );
}
