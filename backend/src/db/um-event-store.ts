import type { SupabaseClient } from "@supabase/supabase-js";
import { publicUmReading, type UmEvent, type UmReading } from "../domain/um-event.js";

const fields = "id,device_id,timestamp,received_at,level_code,status,waterline_y_px,trigger";

export interface UmEventStore {
  save(event: UmEvent): Promise<{ reading: UmReading; duplicate: boolean }>;
  history(deviceId: string, limit: number, since?: string): Promise<UmReading[]>;
}

export class SupabaseUmEventStore implements UmEventStore {
  constructor(private readonly db: SupabaseClient) {}

  async save(event: UmEvent) {
    const row = {
      device_id: event.device_id, timestamp: event.timestamp, level_code: event.level_code,
      status: event.status, waterline_y_px: event.waterline_y_px, trigger: event.trigger,
      raw_rtsp: event.streams?.raw_rtsp ?? null, ai_rtsp: event.streams?.ai_rtsp ?? null,
    };
    const { data, error } = await this.db.from("um_events")
      .upsert(row, { onConflict: "device_id,timestamp,trigger", ignoreDuplicates: true }).select(fields);
    if (error) throw new Error("Unable to persist UM event");
    if (data?.[0]) return { reading: publicUmReading(data[0]), duplicate: false };
    const existing = await this.db.from("um_events").select(fields)
      .eq("device_id", event.device_id).eq("timestamp", event.timestamp).eq("trigger", event.trigger).single();
    if (existing.error || !existing.data) throw new Error("Unable to read duplicate UM event");
    return { reading: publicUmReading(existing.data), duplicate: true };
  }

  async history(deviceId: string, limit: number, since?: string) {
    const readings: UmReading[] = [];
    while (readings.length < limit) {
      const size = Math.min(1000, limit - readings.length);
      let query = this.db.from("um_events").select(fields).eq("device_id", deviceId);
      if (since) query = query.gte("timestamp", since);
      const { data, error } = await query.order("timestamp", { ascending: false })
        .order("received_at", { ascending: false }).order("id", { ascending: false })
        .range(readings.length, readings.length + size - 1);
      if (error) throw new Error("Unable to read UM history");
      readings.push(...(data ?? []).map(publicUmReading));
      if ((data?.length ?? 0) < size) break;
    }
    return readings;
  }
}
