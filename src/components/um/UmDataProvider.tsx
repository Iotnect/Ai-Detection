"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isUmReading, type UmReading } from "@/lib/um-events";
import { isNeoVisionHost } from "@/lib/workspace";

interface UmData {
  events: UmReading[];
  trend: UmReading[];
  latest?: UmReading;
  isLoading: boolean;
  error?: string;
  isLive: boolean;
}
const UmDataContext = createContext<UmData | null>(null);

export function UmDataProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<UmReading[]>([]);
  const [trend, setTrend] = useState<UmReading[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isNeoVisionHost(window.location.hostname)) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!apiUrl) { setError("UM data connection unavailable."); setLoading(false); return; }
    let stopped = false;
    let fetching = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (fetching || stopped) return;
      fetching = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch(`${apiUrl}/api/v1/um/events?limit=1000`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("UM data connection unavailable.");
        const body: { data?: unknown; trend?: unknown } = await response.json();
        if (!Array.isArray(body.data) || !body.data.every(isUmReading) ||
          !Array.isArray(body.trend) || !body.trend.every(isUmReading)) throw new Error("Unable to read UM data.");
        if (!stopped) {
          setEvents(body.data.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
          setTrend(body.trend.slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)));
          setError(undefined);
        }
      } catch {
        if (!stopped) setError("UM data connection unavailable. Retrying...");
      } finally {
        window.clearTimeout(timeout);
        fetching = false;
        if (!stopped) { setLoading(false); setNow(Date.now()); }
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void refresh();
    }, 10_000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);

  const latest = events[0];
  const age = latest ? now - Date.parse(latest.timestamp) : Infinity;
  const receiptAge = latest ? now - Date.parse(latest.received_at) : Infinity;
  const isLive = !error && age >= -30_000 && age <= 120_000 && receiptAge <= 120_000;
  return <UmDataContext.Provider value={{ events, trend, latest, isLoading, error, isLive }}>{children}</UmDataContext.Provider>;
}

export function useUmData() {
  const data = useContext(UmDataContext);
  if (!data) throw new Error("UM data provider is required");
  return data;
}
