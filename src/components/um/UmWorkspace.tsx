"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Maximize2, X } from "lucide-react";
import { umDemo } from "@/lib/um-demo";
import { UmDisplayLog, UmEventLog, UmWaterLevel } from "./UmDemoData";
import UmMap from "@/components/map/UmMap";

type View = "dashboard" | "ai-detection" | "water-level" | "display-log" | "reporting";
type Mode = "original" | "ai";

const titles: Record<View, string> = {
  dashboard: "Dashboard", "ai-detection": "AI Detection", "water-level": "Water Level",
  "display-log": "Display Log", reporting: "Reporting",
};

function DemoVideo({ mode }: { mode: Mode }) {
  const [failed, setFailed] = useState(false);
  const src = umDemo.videos[mode];
  useEffect(() => setFailed(false), [src]);

  return (
    <div className="relative aspect-video w-full bg-black">
      {src && !failed ? (
        <video key={src} src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}${src}`}
          className="camera-video h-full w-full object-contain" aria-label={`UM ${mode} video`}
          width={1920} height={1080} autoPlay loop muted playsInline controls={false}
          onError={() => setFailed(true)} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center text-[#cbd5e1]">
          <Camera size={28} aria-hidden="true" />
          <p className="text-sm">{failed ? "Video is unavailable." : `${mode === "ai" ? "AI" : "Original"} video has not been added yet.`}</p>
        </div>
      )}
      <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
        {mode === "ai" ? "AI DEMO REPLAY" : "DEMO REPLAY"}
      </span>
    </div>
  );
}

export default function UmWorkspace({ view }: { view: View }) {
  const [mode, setMode] = useState<Mode>("original");
  const [enlarged, setEnlarged] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!enlarged) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setEnlarged(false); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [enlarged]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold text-white">{titles[view]}</h1>
        <p className="mt-1 text-sm text-slate-400">Universiti Malaya</p></div>

      {view === "dashboard" && <>
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="font-semibold text-white">Camera overview</h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm text-slate-200">{umDemo.cameraName}</p>
              <p className="mt-1 text-sm text-slate-400">Q Bistro Universiti Malaya</p></div>
            <Link href="/um/ai-detection" className="rounded-lg bg-blue-600 px-4 py-3 text-sm text-white transition hover:bg-blue-500 active:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">Open AI Detection</Link>
          </div>
        </section>
        <UmMap />
      </>}

      {view === "ai-detection" && <>
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="font-semibold text-white">Camera</h2><p className="mt-1 text-sm text-slate-400">Video from {umDemo.cameraName}</p></div>
            <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900 p-1" aria-label="UM stream mode">
              {(["original", "ai"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value}
                onClick={() => setMode(value)} className={`min-h-11 rounded-md px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-blue-400 ${mode === value ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 active:bg-slate-700"}`}>
                {value === "ai" ? "AI Detection" : "Original"}</button>)}
            </div>
          </div>
          <article className="relative max-w-3xl overflow-hidden rounded-xl border border-slate-700">
            {!enlarged && <DemoVideo mode={mode} />}
            {enlarged && <div className="aspect-video bg-black" />}
            <button type="button" onClick={() => setEnlarged(true)} aria-label="Enlarge UM video"
              className="absolute right-3 top-3 rounded-md bg-black/70 p-3 text-white hover:bg-blue-600 active:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-400"><Maximize2 size={18} /></button>
          </article>
        </section>
        <UmEventLog />
      </>}

      {view === "water-level" && <UmWaterLevel />}

      {view === "display-log" && <UmDisplayLog />}

      {view === "reporting" && <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="font-semibold text-white">Reporting period</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-400">From date<input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-200 focus:outline-2 focus:outline-blue-500" /></label>
          <label className="flex flex-col gap-2 text-sm text-slate-400">To date<input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-200 focus:outline-2 focus:outline-blue-500" /></label>
        </div>
        <button type="button" disabled className="mt-5 cursor-not-allowed rounded-lg bg-blue-600 px-4 py-3 text-sm text-white opacity-40">Export PDF</button>
        <p className="mt-3 text-sm text-slate-400">PDF export is currently unavailable.</p>
      </section>}

      {enlarged && <dialog ref={dialogRef} aria-label="UM video" onCancel={() => setEnlarged(false)} onClose={() => setEnlarged(false)}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-0 backdrop:bg-black/90"
        onClick={(event) => { if (event.target === event.currentTarget) setEnlarged(false); }}>
        <section>
          <div className="flex items-center justify-between px-4 py-2"><h2 className="font-semibold text-white">{umDemo.cameraName}</h2>
            <button autoFocus type="button" onClick={() => setEnlarged(false)} aria-label="Close enlarged UM video" className="rounded-lg p-3 text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-500"><X size={20} /></button></div>
          <DemoVideo mode={mode} />
        </section>
      </dialog>}
    </div>
  );
}
