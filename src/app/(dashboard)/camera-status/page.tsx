"use client";

import { RefreshCw } from "lucide-react";
import SerembanMap from "@/components/map/SerembanMap";

import {
  type CameraConnectionStatus,
  useCameraStatuses,
} from "@/hooks/useCameraStatuses";

const statusStyle: Record<CameraConnectionStatus, string> = {
  online: "bg-emerald-500/10 text-emerald-400",
  offline: "bg-slate-500/10 text-slate-400",
  reconnecting: "bg-amber-500/10 text-amber-400",
  error: "bg-red-500/10 text-red-400",
};

function cameraMessage(status: CameraConnectionStatus, lastSeenAt: string | null) {
  if (status === "online") {
    return lastSeenAt
      ? `Online now · Last checked ${new Date(lastSeenAt).toLocaleString("en-MY")}`
      : "Online now";
  }

  if (!lastSeenAt) return "No online activity recorded yet";

  return `Last online ${new Date(lastSeenAt).toLocaleString("en-MY")}`;
}

function cameraLabel(name: string, location: string | null) {
  const match = name.trim().match(/^(MBS-KDN-C\d+)\s+(.+)$/i);

  if (match) {
    return {
      name: match[1].toUpperCase(),
      location: location || match[2],
    };
  }

  return { name, location };
}

export default function CameraStatusPage() {
  const { cameras, isLoading, error, refresh } = useCameraStatuses();
  const onlineCount = cameras.filter((camera) => camera.status === "online").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            DSS camera connectivity for MBS
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <SerembanMap cameras={cameras} statusesLoading={isLoading} statusesError={error} />

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm">
          <span className="font-medium text-white">Camera connectivity</span>
          <span className="text-slate-500">
            {onlineCount} online / {cameras.length} total
          </span>
        </div>

        {isLoading && !cameras.length ? (
          <p className="p-8 text-center text-sm text-slate-400">
            Loading camera statuses...
          </p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-400">{error}</p>
        ) : !cameras.length ? (
          <p className="p-8 text-center text-sm text-slate-400">
            No cameras found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Camera name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cameras.map((camera) => {
                  const label = cameraLabel(camera.name, camera.location);

                  return (
                    <tr key={camera.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-200">{label.name}</p>
                        {label.location && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {label.location}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium uppercase ${statusStyle[camera.status]}`}
                        >
                          {camera.status}
                        </span>
                      </td>
                      <td className="min-w-72 px-4 py-3 text-slate-400">
                        {cameraMessage(camera.status, camera.last_seen_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
