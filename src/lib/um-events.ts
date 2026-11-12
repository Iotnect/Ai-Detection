export type UmWaterStatus = "NORMAL" | "RISING" | "WARNING" | "DANGER";

export interface UmReading {
  id: string;
  device_id: string;
  camera_id: "UM-C1";
  timestamp: string;
  received_at: string;
  level_code: number;
  status: UmWaterStatus;
  waterline_y_px: number;
  trigger: string;
  message: string;
}

export function umStatusClass(status?: UmWaterStatus) {
  if (status === "DANGER") return "text-red-400";
  if (status === "RISING" || status === "WARNING") return "text-amber-400";
  return "text-emerald-400";
}

export function formatUmTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export function isUmReading(value: unknown): value is UmReading {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && row.camera_id === "UM-C1" && typeof row.device_id === "string" &&
    typeof row.timestamp === "string" && Number.isFinite(Date.parse(row.timestamp)) &&
    typeof row.received_at === "string" && Number.isFinite(Date.parse(row.received_at)) &&
    typeof row.waterline_y_px === "number" && Number.isFinite(row.waterline_y_px) &&
    ["NORMAL", "RISING", "WARNING", "DANGER"].includes(String(row.status)) &&
    typeof row.message === "string" && typeof row.trigger === "string" && Number.isInteger(row.level_code);
}
