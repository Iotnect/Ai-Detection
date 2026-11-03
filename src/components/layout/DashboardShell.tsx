"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function DashboardShell({
  children,
  demo = false,
}: {
  children: React.ReactNode;
  demo?: boolean;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!demo && !isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [demo, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileSidebarOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  if (!demo && (isLoading || !isAuthenticated)) {
    return (
      <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
        <p className="text-slate-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-200 overflow-hidden">
      {!isMobileSidebarOpen && (
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="fixed left-2 top-3 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-white shadow-lg shadow-black/30 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden"
          aria-label="Open navigation"
          aria-controls="primary-navigation"
          aria-expanded="false"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      )}

      {isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <Sidebar
        demo={demo}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onToggleCollapse={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar demo={demo} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
