"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Activity, Camera, ChevronRight, Maximize2, VideoOff, X } from "lucide-react";
import HlsPlayer from "@/components/cctv/HlsPlayer";
import { useCameraStatuses } from "@/hooks/useCameraStatuses";
import { useDetectionStream } from "@/hooks/useDetectionStream";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const liveHlsUrl = process.env.NEXT_PUBLIC_HLS_URL;
const aiHlsUrl = liveHlsUrl
  ? new URL("/mbs-kdn-c1-ai/index.m3u8", liveHlsUrl).toString()
  : undefined;

const cameraFeeds = [
  { id: 1, name: "MBS-KDN-C1", location: "Sungai Taman Ros Merah", src: "camera-1.v2.mp4" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { detections, connectionState } = useDetectionStream();
  const { cameras, isLoading: areCameraStatusesLoading } = useCameraStatuses();
  const [selectedCamera, setSelectedCamera] = useState<
    (typeof cameraFeeds)[number] | null
  >(null);
  const [streamMode, setStreamMode] = useState<"original" | "ai">("original");
  const canViewLiveFeed = Boolean(user);
  const selectedHlsUrl = streamMode === "ai" ? aiHlsUrl : liveHlsUrl;
  const handleAiUnavailable = useCallback(() => setStreamMode("original"), []);
  const onlineCameraCount = cameras.filter(
    (camera) => camera.status === "online",
  ).length;

  useEffect(() => {
    if (!selectedCamera) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCamera(null);
    };
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCamera]);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time flood monitoring &bull; Sungai Taman Ros Merah
          </p>
        </div>

        <Link
          href="/camera-status"
          className="group flex min-w-52 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 transition hover:border-blue-500/60 hover:bg-slate-800/80"
          aria-label="Open camera status page"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <Camera size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Camera Status</p>
            <p className="mt-0.5 font-semibold text-white">
              {areCameraStatusesLoading && !cameras.length
                ? "Loading..."
                : `${onlineCameraCount} online / ${cameras.length} total`}
            </p>
          </div>
          <ChevronRight
            size={17}
            className="text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-400"
          />
        </Link>
      </div>

      {/* Single production camera */}
      <section className="space-y-3" aria-labelledby="camera-playback-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="camera-playback-heading" className="font-semibold text-white">
              Live Camera
            </h2>
            <p className="text-sm text-slate-400">
              Real-time monitoring from MBS-KDN-C1
            </p>
          </div>
          <div className="flex items-center gap-2">
            {liveHlsUrl && (
              <div
                className="flex rounded-lg border border-slate-700 bg-slate-900 p-1"
                aria-label="Camera stream mode"
              >
                <button
                  type="button"
                  onClick={() => setStreamMode("original")}
                  className={`rounded-md px-3 py-1 text-xs transition ${
                    streamMode === "original"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setStreamMode("ai")}
                  disabled={!aiHlsUrl}
                  className={`rounded-md px-3 py-1 text-xs transition ${
                    streamMode === "ai"
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  AI Detection
                </button>
              </div>
            )}
            <span className="text-xs text-slate-500 whitespace-nowrap">1 camera</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cameraFeeds.map((camera) => (
            <article
              key={camera.id}
              className="bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden"
            >
              <div className="aspect-video bg-black relative">
                {canViewLiveFeed ? (
                  <>
                    {selectedHlsUrl ? (
                      <HlsPlayer
                        key={streamMode}
                        className="h-full w-full object-cover cursor-zoom-in"
                        src={selectedHlsUrl}
                        ariaLabel={`${camera.name} ${streamMode} live camera footage`}
                        targetLatencySeconds={streamMode === "original" ? 5 : undefined}
                        onClick={() => setSelectedCamera(camera)}
                        onUnavailable={
                          streamMode === "ai" ? handleAiUnavailable : undefined
                        }
                      />
                    ) : (
                      <video
                        className="h-full w-full object-cover cursor-zoom-in"
                        src={`${basePath}/${camera.src}`}
                        aria-label={`${camera.name} recorded camera footage`}
                        onClick={() => setSelectedCamera(camera)}
                        autoPlay
                        controls
                        loop
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )}

                    <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/65 px-2.5 py-1 pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-[11px] text-white font-semibold tracking-wide">
                        {selectedHlsUrl
                          ? streamMode === "ai"
                            ? "AI LIVE"
                            : "LIVE"
                          : "DEMO REPLAY"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCamera(camera)}
                      className="absolute top-3 right-3 z-10 rounded-md bg-black/65 p-2 text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      aria-label={`Enlarge ${camera.name}`}
                    >
                      <Maximize2 size={16} />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-center">
                    <div className="rounded-full border border-slate-700 bg-slate-900 p-4">
                      <VideoOff size={28} className="text-slate-500" />
                    </div>
                    <p className="mt-3 font-medium text-slate-300">No live feed</p>
                    <p className="mt-1 text-xs text-slate-500">Camera access is unavailable</p>
                  </div>
                )}

                <div className="absolute bottom-10 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-3 pointer-events-none">
                  <p className="text-white text-sm font-medium">{camera.name}</p>
                  <p className="text-slate-300 text-xs">{camera.location}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {canViewLiveFeed && selectedCamera && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selected-camera-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCamera(null);
          }}
        >
          <div className="w-full max-w-6xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h2 id="selected-camera-title" className="font-semibold text-white">
                  {selectedCamera.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedCamera.location} &middot; {selectedHlsUrl
                    ? streamMode === "ai"
                      ? "AI Detection"
                      : "Original live"
                    : "Demo replay"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCamera(null)}
                className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Close enlarged camera view"
              >
                <X size={20} />
              </button>
            </div>

            <div className="aspect-video bg-black">
              {selectedHlsUrl ? (
                <HlsPlayer
                  key={`${selectedCamera.id}-${streamMode}`}
                  className="h-full w-full object-contain"
                  src={selectedHlsUrl}
                  ariaLabel={`${selectedCamera.name} enlarged ${streamMode} live camera footage`}
                  targetLatencySeconds={streamMode === "original" ? 5 : undefined}
                  onUnavailable={
                    streamMode === "ai" ? handleAiUnavailable : undefined
                  }
                />
              ) : (
                <video
                  key={selectedCamera.id}
                  className="h-full w-full object-contain"
                  src={`${basePath}/${selectedCamera.src}`}
                  aria-label={`${selectedCamera.name} enlarged recorded camera footage`}
                  autoPlay
                  controls
                  loop
                  muted
                  playsInline
                  preload="auto"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Log */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={18} className="text-blue-400" />
          <h2 className="font-semibold text-white">Event Log</h2>
          {connectionState !== "disabled" && (
            <span
              className={`ml-auto text-xs ${
                connectionState === "online" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {connectionState === "online" ? "Live" : "Reconnecting"}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {connectionState === "connecting" ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
              Connecting to AI event stream...
            </p>
          ) : !detections.length ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
              Waiting for AI inference events.
            </p>
          ) : (
            detections.map((detection) => ({
                id: `${detection.camera_id}-${detection.received_at}`,
                type: detection.event_type,
                message: detection.message,
                time: new Date(detection.timestamp).toLocaleString(),
                level:
                  detection.status.toUpperCase() === "DANGER"
                    ? "danger"
                    : detection.status.toUpperCase() === "RISING"
                      ? "warning"
                      : detection.status.toUpperCase() === "NORMAL"
                    ? "normal"
                    : "unknown",
              })).map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200">
                    {event.type === "WATER_LEVEL" ? "STATUS" : event.type}
                  </p>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {event.time}
                  </span>
                </div>
                <p
                  className={`mt-0.5 text-sm font-bold ${
                    event.level === "danger"
                      ? "text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]"
                      : event.level === "warning"
                        ? "text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]"
                        : event.level === "normal"
                          ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
                          : "text-slate-300"
                  }`}
                >
                  {event.message}
                </p>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
