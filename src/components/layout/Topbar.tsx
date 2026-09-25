"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CloudSun } from "lucide-react";

import { useDetectionStream } from "@/hooks/useDetectionStream";

function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { detections } = useDetectionStream();
  const alerts = detections.filter(
    (detection) => detection.status.toUpperCase() !== "NORMAL",
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`relative rounded-lg transition hover:bg-slate-800 ${compact ? "p-1.5" : "p-2"}`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={compact ? 17 : 18} className="text-slate-400" />
        {alerts.length > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <span className="text-xs text-slate-500">{alerts.length} active</span>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {!alerts.length ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">
                No active water-level alerts.
              </p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={`${alert.camera_id}-${alert.received_at}`}
                  className="flex gap-3 rounded-lg p-3 hover:bg-slate-800"
                >
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200">
                      {alert.camera_id} &bull; {alert.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{alert.message}</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {new Date(alert.timestamp).toLocaleString("en-MY")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            href="/display-log"
            onClick={() => setIsOpen(false)}
            className="block border-t border-slate-800 px-4 py-3 text-center text-xs font-medium text-blue-400 hover:bg-slate-800"
          >
            View complete event log
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Topbar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const time = now?.toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now?.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-[#0b1220] pl-14 pr-2 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <h1 className="truncate text-xs font-medium text-white sm:text-sm">
          AI Detection<span className="hidden sm:inline"> Dashboard</span>
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-5">
        <div className="flex items-center gap-1.5 sm:hidden">
          <CloudSun size={15} className="shrink-0 text-amber-400" />
          <div className="text-right text-[10px] leading-tight">
            <div className="flex items-center justify-end gap-1.5">
              <span className="font-medium text-slate-200">28&deg;C</span>
              <span className="font-mono text-blue-400">{time ?? "--:--"}</span>
            </div>
            <p className="mt-0.5 whitespace-nowrap text-slate-400">{date ?? ""}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-sm text-slate-300 sm:flex">
          <CloudSun size={16} className="text-amber-400" />
          <span>28&deg;C</span>
          <span className="hidden text-slate-500 md:inline">|</span>
          <span className="hidden text-slate-400 md:inline">{date ?? ""}</span>
          <span className="font-mono text-blue-400">{time ?? "--:--"}</span>
        </div>

        <NotificationBell compact />
      </div>
    </header>
  );
}
