export type DemoWaterStatus = "NORMAL" | "RISING" | "DANGER";

export interface UmDemoEvent {
  camera_id: string;
  timestamp: string;
  smoothed_y: number;
  status: DemoWaterStatus;
  message: string;
}

// Illustrative pixel readings based on the MBS display format, not UM measurements.
const samples: [string, number, DemoWaterStatus][] = [
  ["2026-10-07T08:00:00+08:00", 331, "NORMAL"],
  ["2026-10-07T10:00:00+08:00", 330, "NORMAL"],
  ["2026-10-07T12:00:00+08:00", 326, "NORMAL"],
  ["2026-10-07T14:00:00+08:00", 310, "RISING"],
  ["2026-10-07T16:00:00+08:00", 301, "RISING"],
  ["2026-10-07T18:00:00+08:00", 289, "DANGER"],
  ["2026-10-07T20:00:00+08:00", 283, "DANGER"],
  ["2026-10-07T22:00:00+08:00", 282, "DANGER"],
  ["2026-10-08T00:00:00+08:00", 295, "RISING"],
  ["2026-10-08T02:00:00+08:00", 308, "RISING"],
  ["2026-10-08T04:00:00+08:00", 324, "NORMAL"],
  ["2026-10-08T06:00:00+08:00", 329, "NORMAL"],
  ["2026-10-08T08:00:00+08:00", 331, "NORMAL"],
];

const messages: Record<DemoWaterStatus, string> = {
  NORMAL: "Water level stable",
  RISING: "Water level rising / attention required",
  DANGER: "High water level / possible overflow",
};

export const umDemoEvents: UmDemoEvent[] = samples.map(([timestamp, smoothed_y, status]) => ({
  camera_id: "UM-DEMO-C1", timestamp, smoothed_y, status, message: messages[status],
}));

export function formatDemoTime(timestamp: string) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(timestamp));
}

export function demoStatusClass(status: DemoWaterStatus) {
  return status === "DANGER" ? "text-red-400" : status === "RISING" ? "text-amber-400" : "text-emerald-400";
}
