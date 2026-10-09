import type { SupabaseClient } from "@supabase/supabase-js";

import type { Detection, StoredDetection } from "../domain/detection.js";
import { getSupabaseAdmin } from "./supabase.js";

export interface DetectionHistoryOptions {
  limit: number;
  from?: string;
  to?: string;
  statuses?: string[];
}

interface DetectionHistoryRow {
  client_id: string;
  event_type: string;
  raw_y: number;
  smoothed_y: number;
  status: string;
  confidence: number | null;
  message: string;
  image_path: string | null;
  occurred_at: string;
  received_at: string;
  cameras: unknown;
}

export interface DetectionStore {
  save(detection: Detection): Promise<StoredDetection>;
  latest(clientId?: string): Promise<StoredDetection[]>;
  history(
    clientId: string | undefined,
    options: DetectionHistoryOptions,
  ): Promise<StoredDetection[]>;
}

class MemoryDetectionStore implements DetectionStore {
  private readonly detections: StoredDetection[] = [];

  async save(detection: Detection): Promise<StoredDetection> {
    const stored = {
      ...detection,
      received_at: new Date().toISOString(),
    };

    this.detections.unshift(stored);
    return stored;
  }

  async latest(clientId?: string): Promise<StoredDetection[]> {
    const latestByCamera = new Map<string, StoredDetection>();

    for (const detection of this.detections) {
      if (clientId && detection.client_id !== clientId) continue;

      if (!latestByCamera.has(detection.camera_id)) {
        latestByCamera.set(detection.camera_id, detection);
      }
    }

    return Array.from(latestByCamera.values());
  }

  async history(
    clientId: string | undefined,
    options: DetectionHistoryOptions,
  ): Promise<StoredDetection[]> {
    return this.detections
      .filter((detection) => {
        if (clientId && detection.client_id !== clientId) return false;
        if (options.from && detection.timestamp < options.from) return false;
        if (options.to && detection.timestamp > options.to) return false;
        if (
          options.statuses?.length &&
          !options.statuses.includes(detection.status.toUpperCase())
        ) {
          return false;
        }
        return true;
      })
      .slice(0, options.limit);
  }
}

class SupabaseDetectionStore implements DetectionStore {
  constructor(private readonly client: SupabaseClient) {}

  async save(detection: Detection): Promise<StoredDetection> {
    const { data: camera, error: cameraError } = await this.client
      .from("cameras")
      .select("id, client_id, location")
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
      camera_location: camera.location,
      received_at: event.received_at,
    };
  }

  async latest(clientId?: string): Promise<StoredDetection[]> {
    const history = await this.history(clientId, { limit: 100 });
    const latestByCamera = new Map<string, StoredDetection>();

    for (const detection of history) {
      if (!latestByCamera.has(detection.camera_id)) {
        latestByCamera.set(detection.camera_id, detection);
      }
    }

    return Array.from(latestByCamera.values());
  }

  async history(
    clientId: string | undefined,
    options: DetectionHistoryOptions,
  ): Promise<StoredDetection[]> {
    const rows: DetectionHistoryRow[] = [];
    const pageSize = 1_000;

    while (rows.length < options.limit) {
      const batchSize = Math.min(pageSize, options.limit - rows.length);
      let query = this.client
        .from("events")
        .select(
          "client_id, event_type, raw_y, smoothed_y, status, confidence, message, image_path, occurred_at, received_at, cameras!inner(code, location)",
        )
        .order("occurred_at", { ascending: false })
        .range(rows.length, rows.length + batchSize - 1);

      if (clientId) query = query.eq("client_id", clientId);
      if (options.from) query = query.gte("occurred_at", options.from);
      if (options.to) query = query.lte("occurred_at", options.to);
      if (options.statuses?.length) query = query.in("status", options.statuses);

      const { data, error } = await query;

      if (error) {
        throw new Error("Unable to read detections from Supabase", {
          cause: error,
        });
      }

      const batch = (data ?? []) as unknown as DetectionHistoryRow[];
      rows.push(...batch);
      if (batch.length < batchSize) break;
    }

    return rows.flatMap((row) => {
      const cameraValue = row.cameras as unknown;
      const camera = Array.isArray(cameraValue) ? cameraValue[0] : cameraValue;
      const cameraRecord = camera as {
        code?: string;
        location?: string | null;
      } | null;
      const cameraCode = cameraRecord?.code;

      if (!cameraCode) {
        return [];
      }

      return [{
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
        camera_location: cameraRecord?.location ?? null,
      } satisfies StoredDetection];
    });
  }
}

export function createDetectionStore(): DetectionStore {
  const client = getSupabaseAdmin();

  if (!client) {
    return new MemoryDetectionStore();
  }

  return new SupabaseDetectionStore(client);
}
