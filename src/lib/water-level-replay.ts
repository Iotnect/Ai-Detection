import type { LiveDetection } from "@/hooks/useDetectionStream";

const DAY_MS = 24 * 60 * 60 * 1_000;
const FRESH_MS = 2 * 60 * 1_000;

export function waterLevelReplay(
  hostname: string | null,
  events: LiveDetection[],
  live: LiveDetection | undefined,
  now: number,
  step: number,
) {
  if (hostname?.toLowerCase() !== "neovision.iotnect.com") return undefined;
  const history = events.filter(event => event.camera_id === "MBS-KDN-C1" &&
    Number.isFinite(event.smoothed_y) && Number.isFinite(Date.parse(event.timestamp)) && Date.parse(event.timestamp) <= now)
    .slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const fresh = [live, history.at(-1)].some(event => event &&
    now - Date.parse(event.timestamp) >= -30_000 && now - Date.parse(event.timestamp) <= FRESH_MS);
  if (fresh || !history.length) return undefined;
  const end = Date.parse(history.at(-1)!.timestamp);
  const window = history.filter(event => Date.parse(event.timestamp) >= end - DAY_MS);
  return { events: window, current: window[step % window.length] };
}
