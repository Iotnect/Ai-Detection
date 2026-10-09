"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LocateFixed, MapPin, RotateCcw, X } from "lucide-react";
import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from "geojson";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { CameraStatusRecord } from "@/hooks/useCameraStatuses";
import { cameraLocations, type MapCameraCode } from "@/lib/camera-locations";
import "leaflet/dist/leaflet.css";
import styles from "./NilaiMap.module.css";

type RoadProperties = { highway: string; name: string; ref: string };
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Props {
  cameras: CameraStatusRecord[];
  statusesLoading: boolean;
  statusesError?: string;
}

export default function NilaiMap({ cameras, statusesLoading, statusesError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const resetView = useRef<(() => void) | null>(null);
  const cameraView = useRef<(() => void) | null>(null);
  const markers = useRef(new Map<MapCameraCode, Marker>());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCode, setSelectedCode] = useState<MapCameraCode | null>(null);
  const selectedLocation = cameraLocations.find((camera) => camera.code === selectedCode);
  const selectedStatus = cameras.find((camera) => camera.code.trim().toUpperCase() === selectedCode);
  const statusLabel = (camera?: CameraStatusRecord) => statusesError
    ? "Status unavailable"
    : statusesLoading && !camera ? "Loading status..." : camera?.status || "Not in camera inventory";

  function selectCamera(code: MapCameraCode) {
    setSelectedCode(code);
    const location = cameraLocations.find((camera) => camera.code === code)!;
    mapRef.current?.setView([location.latitude, location.longitude], Math.max(16, mapRef.current.getZoom()));
  }

  // Update marker appearance without recreating the map or interrupting pan/zoom.
  useEffect(() => {
    for (const location of cameraLocations) {
      const marker = markers.current.get(location.code);
      const element = marker?.getElement();
      const camera = cameras.find((record) => record.code.trim().toUpperCase() === location.code);
      if (!element) continue;
      element.dataset.status = statusesError ? "unknown" : camera?.status || "unknown";
      element.dataset.selected = String(location.code === selectedCode);
      const status = statusesError ? "Status unavailable" : statusesLoading && !camera ? "Loading status" : camera?.status || "Not in camera inventory";
      element.setAttribute("aria-label", `${location.code}: ${location.location}. ${status}. Open camera status`);
      element.setAttribute("aria-pressed", String(location.code === selectedCode));
      marker?.setZIndexOffset(location.code === selectedCode ? 1000 : 0);
    }
  }, [cameras, statusesLoading, statusesError, selectedCode, state]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let map: LeafletMap | undefined;
    setState("loading");

    async function loadMap() {
      const [L, boundaryResponse, roadsResponse] = await Promise.all([
        import("leaflet"),
        fetch(`${basePath}/maps/nilai-boundary.geojson`, { signal: controller.signal }),
        fetch(`${basePath}/maps/nilai-roads.geojson`, { signal: controller.signal }),
      ]);
      if (!boundaryResponse.ok || !roadsResponse.ok) throw new Error("Map data unavailable");
      const [boundary, roads] = await Promise.all([
        boundaryResponse.json() as Promise<Feature<Polygon>>,
        roadsResponse.json() as Promise<FeatureCollection<LineString, RoadProperties>>,
      ]);
      if (disposed || !container.current) return;

      map = L.map(container.current, {
        preferCanvas: true, minZoom: 10, maxZoom: 19,
        scrollWheelZoom: false, zoomSnap: 0.25,
      });
      mapRef.current = map;
      map.attributionControl.setPrefix(false);
      map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>');

      const boundaryLayer = L.geoJSON(boundary, {
        interactive: false,
        style: { color: "#fb7185", weight: 2, dashArray: "6 6", fillColor: "#12243a", fillOpacity: 0.55 },
      }).addTo(map);

      const roadStyle = (feature?: Feature<Geometry, RoadProperties>) => {
        const road = feature?.properties.highway || "";
        const zoom = map?.getZoom() || 12;
        const major = /^(motorway|trunk)/.test(road);
        const main = /^(primary|secondary)/.test(road);
        const tertiary = road.startsWith("tertiary");
        return {
          color: major ? "#e8bb76" : main ? "#9ebbd4" : tertiary ? "#6f91ae" : "#425e79",
          weight: major ? 2.8 : main ? 1.8 : tertiary ? 1.2 : zoom >= 15 ? 1.1 : 0.65,
          opacity: road === "service" && zoom < 15 ? 0 : 0.95,
        };
      };
      const roadLayer = L.geoJSON(roads, {
        style: roadStyle,
        onEachFeature(feature, layer) {
          const name = feature.properties.name || feature.properties.ref;
          if (name) {
            const label = document.createElement("span");
            label.textContent = [feature.properties.name, feature.properties.ref].filter(Boolean).join(" · ");
            layer.bindTooltip(label, { sticky: true });
          }
        },
      }).addTo(map);
      const bounds = boundaryLayer.getBounds();
      map.setMaxBounds(bounds.pad(0.35));
      const fit = () => map?.fitBounds(bounds, { padding: [28, 28] });
      resetView.current = fit;
      const cameraBounds = L.latLngBounds(cameraLocations.map((camera) => [camera.latitude, camera.longitude]));
      cameraView.current = () => map?.fitBounds(cameraBounds, { padding: [65, 65], maxZoom: 16 });
      cameraView.current();
      for (const camera of cameraLocations) {
        const label = camera.code.replace("MBS-KDN-", "");
        const icon = L.divIcon({
          className: styles.cameraMarker,
          html: `<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg><span>${label}</span>`,
          iconSize: [46, 42], iconAnchor: [23, 42], tooltipAnchor: [0, -42],
        });
        const marker = L.marker([camera.latitude, camera.longitude], {
          icon, title: `${camera.code} - ${camera.location}`, keyboard: true,
          bubblingMouseEvents: false,
        }).addTo(map);
        const tooltip = document.createElement("span");
        tooltip.textContent = `${camera.code} · ${camera.location}`;
        marker.bindTooltip(tooltip, { direction: "top" });
        marker.on("click", () => setSelectedCode(camera.code));
        marker.getElement()?.addEventListener("keydown", (event) => {
          if (event.key === " ") { event.preventDefault(); event.stopPropagation(); setSelectedCode(camera.code); }
        });
        markers.current.set(camera.code, marker);
      }
      map.on("zoomend", () => roadLayer.setStyle(roadStyle));
      let inspection: ReturnType<typeof L.circleMarker> | undefined;
      map.on("click", (event) => {
        setPoint({ lat: event.latlng.lat, lng: event.latlng.lng });
        inspection?.remove();
        inspection = L.circleMarker(event.latlng, {
          radius: 5, color: "#e0f2fe", weight: 2, fillColor: "#38bdf8", fillOpacity: 1,
          interactive: false,
        }).addTo(map!);
      });
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(container.current);
      setState("ready");
    }
    void loadMap().catch(() => {
      if (!disposed) setState("error");
    });
    return () => {
      disposed = true;
      controller.abort();
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      resetView.current = null;
      cameraView.current = null;
      markers.current.clear();
    };
  }, [attempt]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60" aria-labelledby="nilai-map-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4">
        <div>
          <h2 id="nilai-map-title" className="flex items-center gap-2 font-semibold text-white">
            <MapPin size={18} className="text-blue-400" /> Nilai camera map
          </h2>
          <p className="mt-1 text-xs text-slate-400">7 MBS-KDN cameras · Select a camera to view its connectivity</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400">Draft coverage</span>
          <button type="button" disabled={state !== "ready"} onClick={() => cameraView.current?.()} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"><Camera size={14} /> Seven cameras</button>
          <button type="button" disabled={state !== "ready"} onClick={() => resetView.current?.()} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            <LocateFixed size={14} /> All Nilai
          </button>
        </div>
      </div>
      <div className={`relative ${styles.frame}`}>
        <div ref={container} className={styles.map} role="region" aria-label="Interactive Nilai road map with seven camera buttons. Use plus and minus to zoom, arrow keys to pan, and Enter to select a focused camera." />
        {state !== "ready" && (
          <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-3 bg-slate-950 text-sm text-slate-400" role="status">
            {state === "loading" ? "Loading Nilai roads..." : "Unable to load the road map."}
            {state === "error" && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-slate-200"><RotateCcw size={14} /> Try again</button>}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-7 left-3 z-[500] rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-2"><span className="w-5 border-t-2 border-amber-200" /> Highways & major roads</div>
          <div className="mt-1 flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-rose-400" /> Draft coverage</div>
          <div className="mt-1">Cameras: green online · amber reconnecting</div>
          <div>Red error · grey offline / unavailable</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-800 px-4 py-3" aria-label="Select camera">
        {cameraLocations.map((camera) => <button key={camera.code} type="button" disabled={state !== "ready"} onClick={() => selectCamera(camera.code)} aria-pressed={selectedCode === camera.code} title={camera.location} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs disabled:opacity-40 ${selectedCode === camera.code ? "border-sky-400 bg-sky-500/10 text-sky-400" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}><Camera size={14} /> {camera.code.replace("MBS-KDN-", "")}</button>)}
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
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <p>Drag to pan · Use + / − to zoom · Click to inspect a location</p>
        <output aria-live="polite" className="font-mono text-sky-400">{point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : "Latitude, longitude"}</output>
        <p className="w-full text-slate-500">Client-supplied camera coordinates. Draft Nilai map coverage and is not an official administrative boundary. Road data: OpenStreetMap, ODbL.</p>
      </div>
    </section>
  );
}
