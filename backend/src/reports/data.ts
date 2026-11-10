import type { SupabaseClient } from "@supabase/supabase-js";
import { reportPeriod } from "./period.js";

export interface ReportReading {
  occurred_at: string;
  status: string;
  smoothed_y: number;
  message: string;
  cameras: { code: string; location: string | null };
}

export async function reportClient(db: SupabaseClient, cameraCode: string, clientId?: string): Promise<string> {
  let query = db.from("cameras").select("client_id").eq("code", cameraCode);
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query.limit(2);
  if (error) throw new Error("Unable to resolve report client");
  if (data?.length !== 1) throw new Error("Report camera must identify one client; set REPORT_CLIENT_ID to disambiguate");
  return data[0]!.client_id;
}

export async function reportReadings(db: SupabaseClient, clientId: string, date: string): Promise<ReportReading[]> {
  const period = reportPeriod(date);
  const readings: ReportReading[] = [];
  for (let offset = 0; ; offset += 1_000) {
    const { data, error } = await db.from("events")
      .select("occurred_at,status,smoothed_y,message,cameras!inner(code,location)")
      .eq("client_id", clientId).eq("event_type", "WATER_LEVEL")
      .gte("occurred_at", period.start).lt("occurred_at", period.end)
      .order("occurred_at").order("id").range(offset, offset + 999);
    if (error) throw new Error("Unable to read daily report data; no report will be sent");
    for (const row of data ?? []) {
      const camera = Array.isArray(row.cameras) ? row.cameras[0] : row.cameras;
      if (!camera) throw new Error("Daily report contains a missing camera");
      readings.push({ ...row, cameras: camera } as ReportReading);
    }
    if ((data?.length ?? 0) < 1_000) return readings;
  }
}
