import { z } from "zod";

export const DetectionSchema = z
  .object({
    camera_id: z.string().min(1).max(100),
    raw_y: z.number().finite().nonnegative(),
    smoothed_y: z.number().finite().nonnegative(),
    status: z.string().min(1).max(32),
    event_type: z.string().min(1).max(64).default("WATER_LEVEL"),
    confidence: z.number().finite().min(0).max(1).nullable().optional(),
    timestamp: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "timestamp must be a valid ISO-8601 date-time",
    }),
    message: z.string().min(1).max(500),
    image_url: z.string().url().nullable().optional(),
  })
  .strict();

export type Detection = z.infer<typeof DetectionSchema>;

export type StoredDetection = Detection & {
  received_at: string;
  client_id?: string;
};
