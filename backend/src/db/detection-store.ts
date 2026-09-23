import type { SupabaseClient } from "@supabase/supabase-js";

import type { Detection, StoredDetection } from "../domain/detection.js";
import { getSupabaseAdmin } from "./supabase.js";

export interface DetectionStore {
  save(detection: Detection): Promise<StoredDetection>;
  latest(clientId?: string): Promise<StoredDetection[]>;
}

class MemoryDetectionStore implements DetectionStore {
  private readonly detections = new Map<string, StoredDetection>();

  async save(detection: Detection): Promise<StoredDetection> {
    const stored = {
      ...detection,
      received_at: new Date().toISOString(),
    };

    this.detections.set(stored.camera_id, stored);
    return stored;
  }

  async latest(): Promise<StoredDetection[]> {
    return Array.from(this.detections.values());
  }
}

class SupabaseDetectionStore implements DetectionStore {
  constructor(private readonly client: SupabaseClient) {}

  async save(detection: Detection): Promise<StoredDetection> {
    const { data: camera, error: cameraError } = await this.client
      .from("cameras")
      .select("id, client_id")
      .eq("code", detection.camera_id)
      .single();

    if (cameraError || !camera) {
      throw new Error(
        `Camera ${detection.camera_id} is not configured in Supabase`,
        { cause: cameraError },
      );
    }

    const { data: event, error: eventError } = await this.client
      .from("events")
      .insert({
        client_id: camera.client_id,
        camera_id: camera.id,
        event_type: detection.event_type,
        raw_y: detection.raw_y,
        smoothed_y: detection.smoothed_y,
        status: detection.status,
        confidence: detection.confidence ?? null,
        message: detection.message,
        image_path: detection.image_url ?? null,
        occurred_at: detection.timestamp,
      })
      .select("received_at")
      .single();

    if (eventError || !event) {
      throw new Error("Unable to persist detection in Supabase", {
        cause: eventError,
      });
    }

    return {
      ...detection,
      client_id: camera.client_id,
      received_at: event.received_at,
    };
  }

  async latest(clientId?: string): Promise<StoredDetection[]> {
    let query = this.client
      .from("events")
      .select(
        "client_id, event_type, raw_y, smoothed_y, status, confidence, message, image_path, occurred_at, received_at, cameras!inner(code)",
      )
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error("Unable to read detections from Supabase", {
        cause: error,
      });
    }

    const latestByCamera = new Map<string, StoredDetection>();

    for (const row of data ?? []) {
      const cameraValue = row.cameras as unknown;
      const camera = Array.isArray(cameraValue) ? cameraValue[0] : cameraValue;
      const cameraCode = (camera as { code?: string } | null)?.code;

      if (!cameraCode || latestByCamera.has(cameraCode)) {
        continue;
      }

      latestByCamera.set(cameraCode, {
        camera_id: cameraCode,
        raw_y: row.raw_y,
        smoothed_y: row.smoothed_y,
        status: row.status,
        event_type: row.event_type,
        confidence: row.confidence,
        timestamp: row.occurred_at,
        message: row.message,
        image_url: row.image_path,
        received_at: row.received_at,
        client_id: row.client_id,
      });
    }

    return Array.from(latestByCamera.values());
  }
}

export function createDetectionStore(): DetectionStore {
  const client = getSupabaseAdmin();

  if (!client) {
    return new MemoryDetectionStore();
  }

  return new SupabaseDetectionStore(client);
}
