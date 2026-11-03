"use client";

import dynamic from "next/dynamic";
import { useHostname } from "@/hooks/useHostname";
import { isNeoVisionHost } from "@/lib/workspace";
import WorkspaceLanding from "@/components/workspaces/WorkspaceLanding";
import DashboardShell from "@/components/layout/DashboardShell";

const AiDetectionPage = dynamic(() => import("@/components/mbs/AiDetectionPage"));

export default function HomePage() {
  const hostname = useHostname();
  if (hostname === null) return null;
  if (isNeoVisionHost(hostname)) return <WorkspaceLanding />;
  return <DashboardShell><AiDetectionPage /></DashboardShell>;
}
