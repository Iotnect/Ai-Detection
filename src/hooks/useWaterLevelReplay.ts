"use client";

import { useEffect, useState } from "react";
import type { LiveDetection } from "./useDetectionStream";
import { useHostname } from "./useHostname";
import { waterLevelReplay } from "@/lib/water-level-replay";

export function useWaterLevelReplay(events: LiveDetection[], live?: LiveDetection) {
  const hostname = useHostname();
  const [clock, setClock] = useState({ now: Date.now(), step: 0 });
  useEffect(() => {
    if (hostname !== "neovision.iotnect.com") return;
    const timer = window.setInterval(() => setClock(previous => ({
      now: Date.now(), step: previous.step + 1,
    })), 5_000);
    return () => window.clearInterval(timer);
  }, [hostname]);
  return waterLevelReplay(hostname, events, live, clock.now, clock.step);
}
