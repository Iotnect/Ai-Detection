"use client";

import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { useHostname } from "@/hooks/useHostname";
import { isNeoVisionHost } from "@/lib/workspace";

export default function UmLayout({ children }: { children: React.ReactNode }) {
  const hostname = useHostname();
  if (hostname === null) return null;
  if (!isNeoVisionHost(hostname)) return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#070b14] p-6 text-slate-200">
      <h1 className="text-xl font-semibold">Page unavailable</h1>
      <p className="text-slate-400">This demo is available on neovision.iotnect.com.</p>
      <Link href="/" className="rounded-lg bg-blue-600 px-5 py-3 text-white focus-visible:outline-2 focus-visible:outline-blue-400">Back to dashboard</Link>
    </main>
  );
  return <DashboardShell demo>{children}</DashboardShell>;
}
