"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Header({ roleLabel }: { roleLabel: string }) {
  const path = usePathname();
  const router = useRouter();
  async function out() {
    await fetch("/api/login", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="wrap top">
      <Link className="brand" href="/dashboard"><span className="dot" />Store Analytics</Link>
      <nav className="nav">
        <span className="who">{roleLabel}</span>
        <Link href="/dashboard" className={path === "/dashboard" ? "on" : ""}>Ask</Link>
        <Link href="/logs" className={path === "/logs" ? "on" : ""}>Log</Link>
        <button onClick={out}>Switch role</button>
      </nav>
    </header>
  );
}
