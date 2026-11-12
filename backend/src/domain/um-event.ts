import { z } from "zod";

const rtspUrl = z.string().max(2048).refine(value => {
  try { return ["rtsp:", "rtsps:"].includes(new URL(value).protocol); }
  catch { return false; }
}, "Expected an RTSP or RTSPS URL");

export const UmEventSchema = z.object({
  device_id: z.string().trim().min(1).max(100),
  timestamp: z.string().datetime({ offset: true }),
  level_code: z.number().int().nonnegative(),
  status: z.enum(["NORMAL", "RISING", "WARNING", "DANGER"]),
  waterline_y_px: z.number().finite().nonnegative(),
  trigger: z.string().trim().min(1).max(64),
  streams: z.object({ raw_rtsp: rtspUrl.optional(), ai_rtsp: rtspUrl.optional() }).strict().optional(),
}).strict();

export type UmEvent = z.infer<typeof UmEventSchema>;
export interface UmReading {
  id: string;
  device_id: string;
  camera_id: "UM-C1";
  timestamp: string;
  received_at: string;
  level_code: number;
  status: UmEvent["status"];
  waterline_y_px: number;
  trigger: string;
  message: string;
}

export function publicUmReading(row: Record<string, unknown>): UmReading {
  const status = row.status as UmReading["status"];
  return {
    id: String(row.id), device_id: String(row.device_id), camera_id: "UM-C1",
    timestamp: String(row.timestamp), received_at: String(row.received_at),
    level_code: Number(row.level_code), status, waterline_y_px: Number(row.waterline_y_px),
    trigger: String(row.trigger),
    message: status === "NORMAL" ? "Water level stable" : status === "DANGER"
      ? "High water level / possible overflow" : "Water level rising / attention required",
  };
}
