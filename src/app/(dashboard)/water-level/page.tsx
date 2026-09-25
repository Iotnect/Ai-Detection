"use client";

import { Activity, Waves } from "lucide-react";

import { useDetectionHistory } from "@/hooks/useDetectionHistory";
import { useDetectionStream } from "@/hooks/useDetectionStream";

const CAMERA_ID = "MBS-KDN-C1";

function statusColor(status?: string): string {
  if (status?.toUpperCase() === "DANGER") return "text-red-400";
  if (status?.toUpperCase() === "WARNING") return "text-amber-400";
  return "text-emerald-400";
}

export default function WaterLevelPage() {
  const { detections, connectionState } = useDetectionStream();
  const { events, isLoading } = useDetectionHistory(1_000);
  const live = detections.find((detection) => detection.camera_id === CAMERA_ID);
  const cameraHistory = events.filter((event) => event.camera_id === CAMERA_ID);
  const latest = live ?? cameraHistory[0];
  const since = Date.now() - 24 * 60 * 60 * 1_000;
  const last24Hours = cameraHistory
    .filter((event) => new Date(event.timestamp).getTime() >= since)
    .slice()
    .reverse();
  const values = last24Hours.map((event) => event.smoothed_y);
  const minY = values.length ? Math.min(...values) : undefined;
  const maxY = values.length ? Math.max(...values) : undefined;
  const chartMin = minY ?? 0;
  const chartRange = Math.max(1, (maxY ?? chartMin + 1) - chartMin);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Water Level</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Real-time water-line monitoring &bull; Sungai Taman Ros Merah
          </p>
        </div>
        <span className={`text-xs ${connectionState === "online" ? "text-emerald-400" : "text-amber-400"}`}>
          {connectionState === "online" ? "Live" : "Reconnecting"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Current Water Y</p>
          <p className="mt-1 text-2xl font-bold text-white">{latest?.smoothed_y ?? "--"}</p>
          <p className={`mt-1 text-xs ${statusColor(latest?.status)}`}>
            {latest?.status ?? "Waiting for AI inference"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">24h Minimum Y</p>
          <p className="mt-1 text-2xl font-bold text-white">{minY ?? "--"}</p>
          <p className="mt-1 text-xs text-slate-500">Higher water position in frame</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">24h Maximum Y</p>
          <p className="mt-1 text-2xl font-bold text-white">{maxY ?? "--"}</p>
          <p className="mt-1 text-xs text-slate-500">Lower water position in frame</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Waves size={18} className="text-blue-400" />
            <h2 className="font-semibold text-white">24-hour Water Y Trend</h2>
          </div>
          <span className="text-xs text-slate-500">{last24Hours.length} samples</span>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400">
            Loading water-level history...
          </div>
        ) : !last24Hours.length ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <Activity size={28} className="text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">Waiting for AI inference data.</p>
            <p className="mt-1 text-xs text-slate-600">
              The chart will populate after the model publishes detections.
            </p>
          </div>
        ) : (
          <>
            <div className="flex h-64 items-end gap-1 overflow-hidden border-b border-slate-700">
              {last24Hours.map((event) => {
                const height = 15 + ((event.smoothed_y - chartMin) / chartRange) * 80;
                const color = event.status.toUpperCase() === "NORMAL"
                  ? "bg-blue-500/80 hover:bg-blue-400"
                  : event.status.toUpperCase() === "DANGER"
                    ? "bg-red-500/80 hover:bg-red-400"
                    : "bg-amber-500/80 hover:bg-amber-400";

                return (
                  <div
                    key={`${event.camera_id}-${event.received_at}`}
                    className={`min-w-1 flex-1 rounded-t transition ${color}`}
                    style={{ height: `${height}%` }}
                    title={`${new Date(event.timestamp).toLocaleString("en-MY")} • Y ${event.smoothed_y} • ${event.status}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>{new Date(last24Hours[0].timestamp).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}</span>
              <span>Water-line Y coordinate</span>
              <span>Now</span>
            </div>
          </>
        )}

        <p className="mt-5 text-center text-xs text-slate-600">
          Values are camera pixel coordinates. A site calibration is required before displaying centimetres or metres.
        </p>
      </div>
    </div>
  );
}
