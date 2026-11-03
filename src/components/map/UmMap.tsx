"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, LocateFixed, MapPin, RotateCcw, X } from "lucide-react";
import type { FeatureCollection, Geometry } from "geojson";
import type { Map as LeafletMap, Marker } from "leaflet";
import { umDemo } from "@/lib/um-demo";
import { demoStatusClass, formatDemoTime, umDemoEvents } from "@/lib/um-demo-data";
import "leaflet/dist/leaflet.css";
import styles from "./NilaiMap.module.css";

type Properties = { name: string; highway: string; building: string; waterway: string; natural: string };
const camera = umDemo.cameraLocation;
const latestReading = umDemoEvents.at(-1)!;
const coverage: [[number, number], [number, number]] = [[3.112629, 101.655867], [3.124629, 101.667867]];

export default function UmMap() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    markerRef.current?.getElement()?.setAttribute("data-selected", String(selected));
  }, [selected, state]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let map: LeafletMap | undefined;
    let resize: ResizeObserver | undefined;
    let theme: MutationObserver | undefined;
    setState("loading");

    async function initialize() {
      const [L, response] = await Promise.all([
        import("leaflet"),
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/maps/um-context.geojson`, { signal: controller.signal }),
      ]);
      if (!response.ok) throw new Error("UM map data unavailable");
      const data = await response.json() as FeatureCollection<Geometry, Properties>;
      if (!data.features?.length) throw new Error("UM map data is empty");
      if (disposed || !container.current) return;

      map = L.map(container.current, {
        preferCanvas: true, minZoom: 13, maxZoom: 19, zoomSnap: 0.25,
        scrollWheelZoom: false, attributionControl: false,
      });
      mapRef.current = map;
      map.setMaxBounds(L.latLngBounds(coverage).pad(0.3));
      map.setView([camera.latitude, camera.longitude], 17);

      const palette = () => {
        const css = getComputedStyle(container.current!);
        const value = (name: string) => css.getPropertyValue(`--map-${name}`).trim();
        return { main: value("main-road"), local: value("local-road"), highway: value("highway"), land: value("land"), surface: value("surface"), focus: value("focus") };
      };
      let colors = palette();
      const context = L.geoJSON<Properties>(data, {
        style: feature => {
          const p = feature?.properties;
          if (p?.building) return { color: colors.local, weight: 0.8, fillColor: colors.land, fillOpacity: 0.65 };
          if (p?.waterway || p?.natural === "water") return { color: colors.focus, weight: 2, fillColor: colors.focus, fillOpacity: 0.18 };
          const major = /^(motorway|trunk)/.test(p?.highway || "");
          const main = /^(primary|secondary|tertiary)/.test(p?.highway || "");
          return { color: major ? colors.highway : main ? colors.main : colors.local, weight: major ? 3.5 : main ? 2.4 : 1.3, opacity: 0.95 };
        },
        onEachFeature(feature, layer) {
          if (!feature.properties.name) return;
          const text = document.createElement("span");
          text.textContent = feature.properties.name;
          layer.bindTooltip(text, { sticky: true });
        },
      }).addTo(map);

      const icon = L.divIcon({
        className: styles.cameraMarker,
        html: '<svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg><span>C1</span>',
        iconSize: [46, 42], iconAnchor: [23, 42], tooltipAnchor: [0, -42],
      });
      const marker = L.marker([camera.latitude, camera.longitude], {
        icon, title: `${camera.code} - ${camera.name}`, keyboard: true, autoPanOnFocus: false, bubblingMouseEvents: false,
      }).addTo(map);
      markerRef.current = marker;
      marker.getElement()?.setAttribute("data-status", "online");
      marker.getElement()?.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();
        marker.getElement()?.focus({ preventScroll: true });
      });
      marker.getElement()?.addEventListener("click", () => setSelected(true));
      marker.getElement()?.addEventListener("keydown", event => {
        if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); setSelected(true); }
      });
      const tooltip = document.createElement("span");
      tooltip.textContent = `${camera.code} · ${camera.name}`;
      marker.bindTooltip(tooltip, { direction: "top" });
      map.on("keydown", event => {
        if (event.originalEvent.key === "Escape") setSelected(false);
      });
      theme = new MutationObserver(() => { colors = palette(); context.setStyle(context.options.style!); });
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      resize = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      resize.observe(container.current);
      setState("ready");
    }

    void initialize().catch(() => {
      if (!disposed) {
        setState("error");
        resize?.disconnect();
        theme?.disconnect();
        map?.remove();
        map = undefined;
        mapRef.current = null;
        markerRef.current = null;
      }
    });
    return () => {
      disposed = true;
      controller.abort();
      resize?.disconnect();
      theme?.disconnect();
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [attempt]);

  const closeDetails = () => { setSelected(false); markerRef.current?.getElement()?.focus(); };
  const buttonStyle = "inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 transition hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-500";

  return (
    <section aria-labelledby="um-map-title" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
        <div><h2 id="um-map-title" className="flex items-center gap-2 font-semibold text-white"><MapPin size={18} className="text-blue-400" aria-hidden="true" /> Universiti Malaya camera map</h2>
          <p className="mt-1 text-xs text-slate-400">1 camera · Select the camera to view its details</p></div>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={state !== "ready"} className={buttonStyle} onClick={() => mapRef.current?.setView([camera.latitude, camera.longitude], 17, { animate: false })}><Camera size={14} aria-hidden="true" /> Camera location</button>
          <button type="button" disabled={state !== "ready"} className={buttonStyle} onClick={() => mapRef.current?.fitBounds(coverage, { padding: [20, 20], animate: false })}><LocateFixed size={14} aria-hidden="true" /> Surrounding area</button>
        </div>
      </div>
      <div className={`relative ${styles.frame}`}>
        <div ref={container} className={styles.map} role="region" aria-label="Interactive Universiti Malaya map. Use plus and minus to zoom, arrow keys to pan, and Enter to select the camera." />
        {selected && state === "ready" && <div className="absolute right-3 top-3 z-[550] max-h-[calc(100%-2rem)] w-80 max-w-[calc(100%-4.5rem)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-4 shadow-xl" role="region" aria-label="UM camera details">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-white">{camera.code}</h3><p className="mt-1 text-sm text-slate-300">{camera.name}</p></div>
            <button type="button" onClick={closeDetails} aria-label="Close UM camera details" className="rounded-lg p-3 text-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-500"><X size={17} /></button></div>
          <p className="mt-2 font-mono text-xs text-slate-400">{camera.latitude.toFixed(6)}, {camera.longitude.toFixed(6)}</p>
          <div className="mt-4 border-t border-slate-700 pt-3"><p className="text-sm text-slate-300">Water level: <strong className={demoStatusClass(latestReading.status)}>{latestReading.status}</strong></p>
            <p className="mt-2 text-xs text-slate-400">Water Y: {latestReading.smoothed_y}<br />{formatDemoTime(latestReading.timestamp)}</p></div>
          <Link href="/um/ai-detection" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-400">Open AI Detection</Link>
        </div>}
        {state !== "ready" && <div role="status" className="absolute inset-0 z-[500] flex flex-col items-center justify-center gap-4 bg-slate-950 p-5 text-center text-sm text-slate-400">
          <p>{state === "loading" ? "Loading Universiti Malaya map..." : "Unable to load the map."}</p>
          {state === "error" && <button type="button" className={buttonStyle} onClick={() => setAttempt(value => value + 1)}><RotateCcw size={14} /> Try again</button>}
        </div>}
      </div>
      <footer className="space-y-2 border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
        <p>Drag to pan · Use + / − to zoom · Click the camera to view details</p>
        <p>Camera coordinates supplied by the user. The displayed area is not an official university boundary.</p>
        <p>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">ODbL 1.0</a></p>
      </footer>
    </section>
  );
}
