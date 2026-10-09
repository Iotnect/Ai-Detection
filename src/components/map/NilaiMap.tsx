"use client";

import { useState } from "react";
import { Camera, Compass, MapPin, X } from "lucide-react";
import type { CameraStatusRecord } from "@/hooks/useCameraStatuses";
import { cameraLocations, type MapCameraCode } from "@/lib/camera-locations";
import styles from "./NilaiMap.module.css";

interface Props {
  cameras: CameraStatusRecord[];
  statusesLoading: boolean;
  statusesError?: string;
}

// Label placement is designed here; points are projected ONLY from client
// coordinates. Leader lines identify points and do not represent roads.
const labels = [
  { x: 55, y: 340, name: "Taman Ros Merah" },
  { x: 225, y: 435, name: "Big Farmasi" },
  { x: 360, y: 265, name: "Petron Pekan Nilai" },
  { x: 470, y: 435, name: "Econsave / Stesen Bas" },
  { x: 610, y: 210, name: "Klinik Kesihatan" },
  { x: 775, y: 365, name: "KTM Nilai" },
  { x: 730, y: 40, name: "Taman Nilai Perdana" },
];
const centreLatitude = 2.8037315;
const centreLongitude = 101.796951;
const scale = 65000;
const points = cameraLocations.map((camera, index) => ({
  ...camera,
  x: 500 + (camera.longitude - centreLongitude) * Math.cos(centreLatitude * Math.PI / 180) * scale,
  y: 280 - (camera.latitude - centreLatitude) * scale,
  label: labels[index],
}));

export default function NilaiMap({ cameras, statusesLoading, statusesError }: Props) {
  const [selectedCode, setSelectedCode] = useState<MapCameraCode | null>(null);
  const selectedLocation = cameraLocations.find((camera) => camera.code === selectedCode);
  const selectedStatus = cameras.find((camera) => camera.code.trim().toUpperCase() === selectedCode);
  const statusLabel = (camera?: CameraStatusRecord) => statusesError
    ? "Status unavailable"
    : statusesLoading && !camera ? "Loading status..." : camera?.status || "Not in camera inventory";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60" aria-labelledby="nilai-map-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 id="nilai-map-title" className="flex items-center gap-2 font-semibold text-white"><MapPin size={18} className="text-blue-400" /> Nilai camera schematic</h2>
          <p className="mt-1 text-xs text-slate-400">Seven camera locations &middot; Select a camera to view its connectivity</p>
        </div>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-400">Location overview</span>
      </div>
      <div className={styles.canvas}>
        <svg viewBox="0 0 1000 560" className={styles.diagram} role="group" aria-labelledby="schematic-title schematic-description">
          <title id="schematic-title">Nilai camera locations</title>
          <desc id="schematic-description">An original schematic showing the relative positions of seven client-supplied camera coordinates. North is up. Lines join labels to camera points; they are not roads. Use Tab and Enter to select cameras.</desc>
          <defs>
            <pattern id="nilai-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1b2c41" strokeWidth="0.6" /></pattern>
          </defs>
          <rect width="1000" height="560" fill="#0b1422" />
          <rect width="1000" height="560" fill="url(#nilai-grid)" />
          <text x="40" y="45" fill="#64748b" fontSize="11" letterSpacing="3">NILAI / MBS-KDN</text>
          <g transform="translate(945 48)" aria-hidden="true"><path d="M 0 34 V 0 M -5 8 L 0 0 L 5 8" fill="none" stroke="#94a3b8" strokeWidth="1.5" /><text x="0" y="-10" fill="#cbd5e1" textAnchor="middle" fontSize="12">N</text></g>
          {points.map((camera) => {
            const record = cameras.find((item) => item.code.trim().toUpperCase() === camera.code);
            const status = statusesError ? "unknown" : record?.status || "unknown";
            const selected = selectedCode === camera.code;
            return (
              <g key={camera.code} className={styles.camera} data-status={status} data-selected={selected} role="button" tabIndex={0} aria-label={`${camera.code}: ${camera.location}. ${statusLabel(record)}. Open status`} aria-pressed={selected} onClick={() => setSelectedCode(camera.code)} onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedCode(camera.code); }
              }}>
                <title>{`${camera.code} - ${camera.location} - ${statusLabel(record)}`}</title>
                <path d={`M ${camera.x} ${camera.y} L ${camera.label.x + 80} ${camera.label.y + 27}`} className={styles.leader} />
                <circle cx={camera.x} cy={camera.y} r="20" className={styles.halo} />
                <circle cx={camera.x} cy={camera.y} r="12" className={styles.point} />
                <Camera x={camera.x - 7} y={camera.y - 7} width="14" height="14" stroke="#f8fafc" aria-hidden="true" />
                <rect x={camera.label.x} y={camera.label.y} width="170" height="58" rx="10" className={styles.label} />
                <text x={camera.label.x + 14} y={camera.label.y + 23} fill="#e2e8f0" fontSize="13" fontWeight="700">{camera.code}</text>
                <text x={camera.label.x + 14} y={camera.label.y + 43} fill="#94a3b8" fontSize="11">{camera.label.name}</text>
                <circle cx={camera.label.x + 152} cy={camera.label.y + 20} r="4" className={styles.point} />
              </g>
            );
          })}
          <text x="40" y="530" fill="#64748b" fontSize="11">Relative camera positions. No road or boundary geometry shown.</text>
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5"><Compass size={14} /> North up &middot; Scroll sideways on smaller screens</span>
        <div className="flex flex-wrap gap-3" aria-label="Connectivity legend">
          <span><span className="text-emerald-400">●</span> Online</span><span><span className="text-amber-400">●</span> Reconnecting</span><span><span className="text-red-400">●</span> Error</span><span><span className="text-slate-400">●</span> Offline / unavailable</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-800 px-5 py-3" aria-label="Select camera">
        {cameraLocations.map((camera) => <button key={camera.code} type="button" onClick={() => setSelectedCode(camera.code)} aria-pressed={selectedCode === camera.code} aria-label={`Open ${camera.code}: ${camera.location}`} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${selectedCode === camera.code ? "border-sky-400 bg-sky-500/10 text-sky-400" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}><Camera size={14} /> {camera.code.replace("MBS-KDN-", "")}</button>)}
      </div>
      {selectedLocation && (
        <div className="border-t border-slate-800 bg-slate-950/60 px-4 py-4" role="region" aria-label={`${selectedLocation.code} camera status`} aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-white"><Camera size={17} className="text-sky-400" /> {selectedLocation.code}</h3>
              <p className="mt-1 text-sm text-slate-300">{selectedLocation.location}</p>
            </div>
            <button type="button" onClick={() => setSelectedCode(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Close camera status"><X size={17} /></button>
          </div>
          <p className="mt-3 text-sm text-slate-200">Connectivity: <strong className="capitalize">{statusLabel(selectedStatus)}</strong></p>
          {statusesError ? <p className="mt-1 text-xs text-amber-400">The latest connectivity check failed. Use Refresh to try again.</p> : selectedStatus?.last_seen_at ? <p className="mt-1 text-xs text-slate-400">Last seen online: {new Date(selectedStatus.last_seen_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} (MYT)</p> : <p className="mt-1 text-xs text-slate-400">No online activity recorded yet.</p>}
          <p className="mt-2 font-mono text-xs text-slate-400">{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</p>
          <p className="mt-2 text-xs text-slate-500">Connectivity updates every 30 seconds.</p>
        </div>
      )}
    </section>
  );
}
