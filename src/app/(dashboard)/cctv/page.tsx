"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Grid2X2, Grid3X3, Maximize2, RefreshCw, Search, X } from "lucide-react";

import HlsPlayer from "@/components/cctv/HlsPlayer";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type CameraStatus = "online" | "offline" | "reconnecting" | "error";

interface CameraRecord {
  id: string;
  code: string;
  name: string;
  location: string | null;
  status: CameraStatus;
  last_seen_at: string | null;
  live_stream_enabled: boolean;
}

const fallbackCameras: CameraRecord[] = [{
  id: "mbs-kdn-c1",
  code: "MBS-KDN-C1",
  name: "MBS-KDN-C1",
  location: "Sungai Taman Ros Merah",
  status: "offline",
  last_seen_at: null,
  live_stream_enabled: true,
}];

const statusPresentation: Record<CameraStatus, { label: string; dot: string; text: string }> = {
  online: { label: "Online", dot: "bg-emerald-400", text: "text-emerald-300" },
  offline: { label: "Offline", dot: "bg-slate-500", text: "text-slate-400" },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-300" },
};

const liveHlsUrl = process.env.NEXT_PUBLIC_HLS_URL;

export default function CCTVPage() {
  const [gridSize, setGridSize] = useState<2 | 3>(3);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadCameras = async () => {
      if (!supabase) {
        if (active) {
          setCameras(fallbackCameras);
          setIsLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from("cameras")
        .select("id, code, name, location, status, last_seen_at, live_stream_enabled")
        .order("name", { ascending: true });

      if (!active) return;

      if (queryError) {
        setError("Senarai kamera tidak dapat dimuatkan.");
      } else {
        setCameras((data ?? []) as CameraRecord[]);
        setError(null);
      }
      setIsLoading(false);
    };

    void loadCameras();
    const timer = window.setInterval(() => void loadCameras(), 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshKey]);

  const filteredCameras = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cameras;

    return cameras.filter((camera) =>
      [camera.name, camera.code, camera.location ?? ""].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [cameras, search]);

  const selectedCamera = cameras.find((camera) => camera.id === selectedCameraId);
  const onlineCount = cameras.filter((camera) => camera.status === "online").length;
  const monitoredCount = cameras.filter((camera) => camera.live_stream_enabled).length;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Pemantauan CCTV</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {onlineCount} online &bull; {cameras.length - onlineCount} offline &bull; {cameras.length} jumlah kamera
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setRefreshKey((key) => key + 1);
            }}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-blue-500 hover:text-white"
            aria-label="Refresh camera statuses"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari kamera..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-52 rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-4 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
            <button
              type="button"
              onClick={() => setGridSize(2)}
              className={cn("p-2 transition", gridSize === 2 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}
              aria-label="Two-column camera grid"
            >
              <Grid2X2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => setGridSize(3)}
              className={cn("p-2 transition", gridSize === 3 ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white")}
              aria-label="Three-column camera grid"
            >
              <Grid3X3 size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        <div className="xl:col-span-3">
          {isLoading && cameras.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-sm text-slate-500">
              Memuatkan status kamera...
            </div>
          ) : (
            <div className={cn("grid gap-4", gridSize === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3")}>
              {filteredCameras.map((camera) => {
                const presentation = statusPresentation[camera.status];

                return (
                  <button
                    type="button"
                    key={camera.id}
                    onClick={() => setSelectedCameraId(camera.id)}
                    className="group overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80 text-left transition hover:border-blue-500/60"
                  >
                    <div className="relative flex aspect-video items-center justify-center bg-slate-950">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md bg-black/55 px-2 py-1">
                        <span className={cn("h-2 w-2 rounded-full", presentation.dot)} />
                        <span className={cn("text-[11px] font-semibold uppercase", presentation.text)}>{presentation.label}</span>
                      </div>
                      {camera.live_stream_enabled && (
                        <span className="absolute right-3 top-3 z-10 rounded-md bg-blue-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Live monitoring
                        </span>
                      )}
                      <Maximize2 size={16} className="absolute bottom-3 right-3 z-10 text-slate-500 transition group-hover:text-white" />
                      <Camera size={34} className="text-slate-700" />
                      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
                        <p className="truncate text-sm font-medium text-white">{camera.name}</p>
                        <p className="truncate text-xs text-slate-400">{camera.location || camera.code}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && filteredCameras.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-16 text-center text-sm text-slate-500">
              Tiada kamera sepadan dengan carian.
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="font-semibold text-white">Ringkasan Status</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Online</dt>
              <dd className="font-semibold text-emerald-300">{onlineCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Offline</dt>
              <dd className="font-semibold text-slate-300">{cameras.length - onlineCount}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <dt className="text-slate-400">Live monitoring</dt>
              <dd className="font-semibold text-blue-300">{monitoredCount}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Hanya MBS-KDN-C1 mempunyai live stream dan pemantauan AI. Kamera lain memaparkan status sambungan DSS sahaja.
          </p>
        </aside>
      </div>

      {selectedCamera && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCameraId(null);
          }}
        >
          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setSelectedCameraId(null)}
              className="absolute -top-12 right-0 flex items-center gap-2 text-slate-300 transition hover:text-white"
            >
              <X size={20} />
              <span className="text-sm">Tutup</span>
            </button>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              <div className="flex aspect-video items-center justify-center bg-black">
                {selectedCamera.live_stream_enabled && liveHlsUrl ? (
                  <HlsPlayer
                    className="h-full w-full object-contain"
                    src={liveHlsUrl}
                    ariaLabel={`${selectedCamera.name} live camera footage`}
                    targetLatencySeconds={5}
                  />
                ) : (
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-sm text-slate-300">Status monitoring sahaja</p>
                    <p className="mt-1 text-xs text-slate-500">Live stream tidak diaktifkan untuk kamera ini.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-800 px-5 py-4">
                <div>
                  <h2 id="camera-dialog-title" className="font-medium text-white">{selectedCamera.name}</h2>
                  <p className="text-xs text-slate-500">{selectedCamera.location || selectedCamera.code}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-medium", statusPresentation[selectedCamera.status].text)}>
                    {statusPresentation[selectedCamera.status].label}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {selectedCamera.last_seen_at ? `Last seen ${new Date(selectedCamera.last_seen_at).toLocaleString()}` : "Belum pernah online"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
