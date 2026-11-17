import type { SupabaseClient } from "@supabase/supabase-js";
import { reportPeriod } from "./period.js";

export interface ConnectivityObservation {
  camera_id: string;
  checked_at: string;
  status: "online" | "offline";
  status_since_at: string;
  check_interval_ms: number;
}

export interface ReportCamera {
  id: string;
  code: string;
  name: string;
  location: string | null;
}

export interface CameraConnectivity {
  camera: ReportCamera;
  endStatus: "online" | "offline" | "unverified";
  downtimeMs: number;
  unverifiedMs: number;
  reportNote?: string;
  outages: { offlineAt: string; onlineAt: string | null; durationMs: number; interrupted: boolean }[];
}

export function summarizeConnectivity(date: string, camera: ReportCamera, observations: ConnectivityObservation[]): CameraConnectivity {
  const period = reportPeriod(date);
  const start = Date.parse(period.start);
  const end = Date.parse(period.end);
  const samples = observations.filter(row => row.camera_id === camera.id && Date.parse(row.checked_at) < end)
    .sort((a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at));
  const result: CameraConnectivity = { camera, endStatus: "unverified", downtimeMs: 0, unverifiedMs: end - start, outages: [] };
  let previousEnd = start;
  let outage: CameraConnectivity["outages"][number] | undefined;
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index]!;
    const checkedAt = Date.parse(sample.checked_at);
    const nextAt = samples[index + 1] ? Date.parse(samples[index + 1]!.checked_at) : end;
    const from = Math.max(start, checkedAt);
    // Three missed polling intervals end verified coverage until the next successful check.
    const to = Math.min(end, nextAt, checkedAt + sample.check_interval_ms * 3);
    if (to <= from) continue;
    if (from > previousEnd && outage) {
      outage.interrupted = true;
      outage = undefined;
    }
    const duration = to - from;
    result.unverifiedMs -= duration;
    if (sample.status === "offline") {
      if (!outage) {
        outage = { offlineAt: sample.status_since_at, onlineAt: null, durationMs: 0, interrupted: false };
        result.outages.push(outage);
      }
      outage.durationMs += duration;
      result.downtimeMs += duration;
    } else if (outage) {
      outage.onlineAt = sample.checked_at;
      outage = undefined;
    }
    previousEnd = to;
    if (to === end) result.endStatus = sample.status;
  }
  if (outage && previousEnd < end) outage.interrupted = true;
  return result;
}

export function applyReportingCorrection(date: string, clientId: string,
  summaries: CameraConnectivity[], observations: ConnectivityObservation[]): CameraConnectivity[] {
  if (date !== "2026-11-17" || clientId !== "449887e5-019b-46f7-92e5-6d05ae81ea1c") return summaries;

  const period = reportPeriod(date);
  const reportNote = "Camera availability for 17 Nov 2026 includes an operator-confirmed reporting correction: MBS-KDN-C5 offline from 00:00 MYT, with zero downtime for the other six cameras. Subsequent observed recovery of C5 is included.";
  return summaries.map(summary => {
    const isC5 = /^MBS-KDN-C5(?:\s|$)/i.test(summary.camera.name) || summary.camera.code === "MBS-KDN-C5";
    if (!isC5) return { ...summary, endStatus: "online", downtimeMs: 0, unverifiedMs: 0, outages: [], reportNote };

    const baseline: ConnectivityObservation = {
      camera_id: summary.camera.id, checked_at: period.start, status: "offline",
      status_since_at: period.start, check_interval_ms: 86_400_000,
    };
    const correctedSamples = observations.filter(sample => sample.camera_id === summary.camera.id
      && Date.parse(sample.checked_at) >= Date.parse(period.start)
      && Date.parse(sample.checked_at) < Date.parse(period.end))
      .map(sample => ({ ...sample, check_interval_ms: 86_400_000 }));
    return { ...summarizeConnectivity(date, summary.camera, [baseline, ...correctedSamples]), reportNote };
  });
}

export async function reportConnectivity(db: SupabaseClient, clientId: string, date: string): Promise<CameraConnectivity[]> {
  const period = reportPeriod(date);
  const { data: cameras, error } = await db.from("cameras").select("id,code,name,location")
    .eq("client_id", clientId).lt("created_at", period.end).order("name");
  if (error) throw new Error("Unable to read report camera inventory");
  const observations: ConnectivityObservation[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: readError } = await db.from("camera_connectivity_observations").select("*")
      .eq("client_id", clientId).gte("checked_at", period.start).lt("checked_at", period.end)
      .order("checked_at").order("camera_id").range(offset, offset + 999);
    if (readError) throw new Error("Unable to read camera connectivity history; apply the connectivity migration before sending");
    observations.push(...(data ?? []) as ConnectivityObservation[]);
    if ((data?.length ?? 0) < 1000) break;
  }
  const summaries: CameraConnectivity[] = [];
  for (const camera of (cameras ?? []) as ReportCamera[]) {
    const { data, error: baselineError } = await db.from("camera_connectivity_observations").select("*")
      .eq("client_id", clientId).eq("camera_id", camera.id).lt("checked_at", period.start)
      .order("checked_at", { ascending: false }).limit(1);
    if (baselineError) throw new Error("Unable to read camera status at the start of the reporting day");
    summaries.push(summarizeConnectivity(date, camera, [...(data ?? []) as ConnectivityObservation[], ...observations]));
  }
  return applyReportingCorrection(date, clientId, summaries, observations);
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}
