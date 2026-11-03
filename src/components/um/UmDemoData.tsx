"use client";

import { useState } from "react";
import { demoStatusClass, formatDemoTime, umDemoEvents, type DemoWaterStatus } from "@/lib/um-demo-data";

const newestFirst = [...umDemoEvents].reverse();
const latest = newestFirst[0];
const minimum = Math.min(...umDemoEvents.map(event => event.smoothed_y));
const maximum = Math.max(...umDemoEvents.map(event => event.smoothed_y));

export function UmEventLog() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4"><h2 className="font-semibold text-white">Event Log</h2></div>
      <div className="space-y-3">{newestFirst.slice(0, 6).map(event => (
        <article key={event.timestamp} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{event.camera_id} · WATER_LEVEL</span><time dateTime={event.timestamp}>{formatDemoTime(event.timestamp)}</time></div>
          <p className={`mt-2 text-sm font-semibold ${demoStatusClass(event.status)}`}>{event.message}</p>
          <p className="mt-1 text-xs text-slate-400">{event.status} · Water Y: {event.smoothed_y}</p>
        </article>
      ))}</div>
    </section>
  );
}

export function UmWaterLevel() {
  return <>
    <div className="grid gap-4 sm:grid-cols-3">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-sm text-slate-400">Current Water Y</h2><p className="mt-2 text-2xl font-semibold text-white">{latest.smoothed_y}</p><p className={`mt-1 text-xs ${demoStatusClass(latest.status)}`}>{latest.status}</p></section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-sm text-slate-400">24h Minimum Y</h2><p className="mt-2 text-2xl font-semibold text-white">{minimum}</p><p className="mt-1 text-xs text-slate-400">Higher water position in frame</p></section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-sm text-slate-400">24h Maximum Y</h2><p className="mt-2 text-2xl font-semibold text-white">{maximum}</p><p className="mt-1 text-xs text-slate-400">Lower water position in frame</p></section>
    </div>
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-white">24-hour Water Y Trend</h2><span className="text-xs text-slate-400">{umDemoEvents.length} readings</span></div>
      <p className="mt-2 text-xs text-slate-400">07 Oct 2026, 08:00 am to 08 Oct 2026, 08:00 am (Malaysia)</p>
      <div role="img" aria-label={`Water Y trend. ${umDemoEvents.length} readings, minimum ${minimum}, maximum ${maximum}, latest ${latest.smoothed_y}. Full readings are available in Display Log.`}
        className="mt-6 flex h-64 items-end gap-1 border-b border-slate-700">
        {umDemoEvents.map(event => <div key={event.timestamp}
          className={`min-w-0 flex-1 rounded-t ${event.status === "DANGER" ? "bg-red-500" : event.status === "RISING" ? "bg-amber-500" : "bg-blue-500"}`}
          style={{ height: `${15 + ((event.smoothed_y - minimum) / Math.max(1, maximum - minimum)) * 80}%` }}
          title={`${formatDemoTime(event.timestamp)} · Y ${event.smoothed_y} · ${event.status}`} />)}
      </div>
      <div className="mt-3 flex justify-between gap-3 text-xs text-slate-400"><span>07 Oct, 08:00</span><span>08 Oct, 08:00</span></div>
      <p className="mt-4 text-sm text-slate-400">Normal: blue. Rising: amber. Danger: red.</p>
      <p className="mt-3 text-xs text-slate-400">Water Y values are pixel coordinates, not measurements in metres.</p>
    </section>
  </>;
}

export function UmDisplayLog() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DemoWaterStatus | "ALL">("ALL");
  const events = newestFirst.filter(event => (status === "ALL" || status === event.status) &&
    `${event.camera_id} ${event.status} ${event.message}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <>
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row">
      <label className="flex flex-1 flex-col gap-2 text-sm text-slate-400">Search events
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search camera, status or message"
          className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 focus:outline-2 focus:outline-blue-500" /></label>
      <label className="flex flex-col gap-2 text-sm text-slate-400">Status
        <select value={status} onChange={event => setStatus(event.target.value as DemoWaterStatus | "ALL")}
          className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 focus:outline-2 focus:outline-blue-500">
          <option value="ALL">All statuses</option><option value="NORMAL">Normal</option><option value="RISING">Rising</option><option value="DANGER">Danger</option>
        </select></label>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap justify-between gap-3 border-b border-slate-800 px-5 py-4 text-sm"><h2 className="font-semibold text-white">Event history</h2><span className="text-slate-400" aria-live="polite">{events.length} of {umDemoEvents.length} records</span></div>
      {events.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <caption className="sr-only">Universiti Malaya water-level events</caption>
        <thead className="bg-slate-950/60 text-xs uppercase text-slate-400"><tr>{["Date & time (MYT)", "Camera", "Event", "Status", "Water Y", "Message"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800">{events.map(event => <tr key={event.timestamp} className="hover:bg-slate-800/40">
          <td className="whitespace-nowrap px-4 py-3 text-slate-400"><time dateTime={event.timestamp}>{formatDemoTime(event.timestamp)}</time></td>
          <td className="whitespace-nowrap px-4 py-3 text-slate-200">{event.camera_id}</td><td className="px-4 py-3 text-slate-400">WATER_LEVEL</td>
          <td className={`px-4 py-3 font-medium ${demoStatusClass(event.status)}`}>{event.status}</td><td className="px-4 py-3 text-slate-300">{event.smoothed_y}</td>
          <td className="min-w-64 px-4 py-3 text-slate-400">{event.message}</td>
        </tr>)}</tbody>
      </table></div> : <p className="p-12 text-center text-sm text-slate-400">No events match your filters.</p>}
    </section>
  </>;
}
