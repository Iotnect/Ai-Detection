import type { SupabaseClient } from "@supabase/supabase-js";

import type { DssCamera } from "../dss/client.js";
import { getSupabaseAdmin } from "./supabase.js";

interface CameraRow {
  client_id: string;
  code: string;
  name: string;
  dss_channel_id: string;
  dss_device_code: string | null;
  stream_path: string;
  location: string | null;
  status: "online" | "offline" | "reconnecting" | "error";
  last_seen_at: string | null;
  live_stream_enabled: boolean;
}

export interface CameraInventoryStore {
  sync(cameras: DssCamera[], monitoringChannelId: string): Promise<number>;
}

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "camera";
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

class SupabaseCameraInventoryStore implements CameraInventoryStore {
  constructor(private readonly client: SupabaseClient) {}

  async sync(cameras: DssCamera[], monitoringChannelId: string): Promise<number> {
    const { data: monitoringCamera, error: monitoringCameraError } = await this.client
      .from("cameras")
      .select("client_id")
      .eq("dss_channel_id", monitoringChannelId)
      .maybeSingle();

    if (monitoringCameraError || !monitoringCamera) {
      throw new Error(
        `Unable to resolve the MBS client from monitoring channel ${monitoringChannelId}`,
        { cause: monitoringCameraError },
      );
    }

    const clientId = monitoringCamera.client_id as string;
    const { data: existingData, error: existingError } = await this.client
      .from("cameras")
      .select(
        "client_id, code, name, dss_channel_id, dss_device_code, stream_path, location, status, last_seen_at, live_stream_enabled",
      )
      .eq("client_id", clientId);

    if (existingError) {
      throw new Error("Unable to read the existing camera inventory", {
        cause: existingError,
      });
    }

    const existingByChannel = new Map(
      ((existingData ?? []) as CameraRow[]).map((camera) => [
        camera.dss_channel_id,
        camera,
      ]),
    );
    const now = new Date().toISOString();
    const clientPrefix = clientId.slice(0, 8);
    const rows = cameras.map((camera): CameraRow => {
      const existing = existingByChannel.get(camera.channelId);
      const slug = stableSlug(camera.channelId);
      const isMonitoringCamera = camera.channelId === monitoringChannelId;

      return {
        client_id: clientId,
        code: existing?.code ?? `${clientPrefix}-dss-${slug}`,
        name: existing?.name ?? camera.channelName,
        dss_channel_id: camera.channelId,
        dss_device_code: camera.deviceCode,
        stream_path: existing?.stream_path ?? `status-${clientPrefix}-${slug}`,
        location: existing?.location ?? null,
        status: camera.online ? "online" : "offline",
        last_seen_at: camera.online ? now : (existing?.last_seen_at ?? null),
        live_stream_enabled: isMonitoringCamera,
      };
    });

    for (const batch of chunk(rows, 200)) {
      const { error } = await this.client.from("cameras").upsert(batch, {
        onConflict: "client_id,dss_channel_id",
      });

      if (error) {
        throw new Error("Unable to synchronize the DSS camera inventory", {
          cause: error,
        });
      }
    }

    return rows.length;
  }
}

export function createCameraInventoryStore(): CameraInventoryStore | undefined {
  const client = getSupabaseAdmin();
  return client ? new SupabaseCameraInventoryStore(client) : undefined;
}
