import { redirect } from "next/navigation";
import Header from "@/components/Header";
import LogsClient from "@/components/LogsClient";
import { currentRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export default function Logs() {
  const role = currentRole();
  if (!role) redirect("/");
  return (
    <>
      <Header roleLabel={role.label} />
      <main className="wrap page">
        <h1 className="display" style={{ fontSize: "clamp(2.4rem,6vw,4.5rem)", marginBottom: 20 }}>Query <span className="serif" style={{ color: "var(--orange)" }}>log</span></h1>
        <LogsClient isCeo={role.id === "ceo"} />
      </main>
    </>
  );
}
