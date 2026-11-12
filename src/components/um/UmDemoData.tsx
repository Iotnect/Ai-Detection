"use client";

import { useState } from "react";
import { formatUmTime, umStatusClass, type UmWaterStatus } from "@/lib/um-events";
import { useUmData } from "./UmDataProvider";

function UmConnectionStatus() {
  const { isLoading, error, latest, isLive } = useUmData();
  const label = isLoading ? "Connecting..." : error ? "Reconnecting" : isLive ? "Live" : latest ? "Last recorded reading" : "Waiting for data";
  return <span className={`text-xs ${isLive ? "text-emerald-400" : "text-amber-400"}`}>{label}</span>;
}

export function UmEventLog() {
  const { latest, isLoading, error } = useUmData();
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-white">Event Log</h2><UmConnectionStatus />
      </div>
      {latest ? (
        <article className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
            <span>{latest.camera_id} · WATER_LEVEL</span>
            <time dateTime={latest.timestamp}>{formatUmTime(latest.timestamp)} (MYT)</time>
          </div>
          <p className={`mt-2 text-sm font-bold ${latest.status === "DANGER"
            ? "text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.7)]"
            : latest.status === "NORMAL"
              ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
              : "text-yellow-300 drop-shadow-[0_0_6px_rgba(253,224,71,0.7)]"}`}>{latest.message}</p>
          <p className="mt-1 text-xs text-slate-400">{latest.status} · Water Y: {latest.waterline_y_px}</p>
        </article>
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">{isLoading ? "Connecting to UM inference..." : error ?? "Waiting for UM inference events."}</p>
      )}
    </section>
  );
}

export function UmWaterLevel() {
  const { trend, latest, isLoading, error } = useUmData();
  const since = Date.now() - 86_400_000;
  const history = trend.filter(event => Date.parse(event.timestamp) >= since);
  const values = history.map(event => event.waterline_y_px);
  const minimum = values.length ? Math.min(...values) : undefined;
  const maximum = values.length ? Math.max(...values) : undefined;
  const bars = history.length > 180
    ? Array.from({ length: 180 }, (_, i) => history[Math.round(i * (history.length - 1) / 179)]!)
    : history;
  return <>
    <div className="flex justify-end"><UmConnectionStatus /></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm text-slate-400">Current Water Y</h2>
        <p className="mt-2 text-2xl font-semibold text-white">{latest?.waterline_y_px ?? "--"}</p>
        <p className={`mt-1 text-xs ${umStatusClass(latest?.status)}`}>{latest?.status ?? "Waiting for inference"}</p>
        {latest && <p className="mt-2 text-xs text-slate-400">{formatUmTime(latest.timestamp)} (MYT)</p>}
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm text-slate-400">24h Minimum Y</h2>
        <p className="mt-2 text-2xl font-semibold text-white">{minimum ?? "--"}</p>
        <p className="mt-1 text-xs text-slate-400">Higher water position in frame</p>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm text-slate-400">24h Maximum Y</h2>
        <p className="mt-2 text-2xl font-semibold text-white">{maximum ?? "--"}</p>
        <p className="mt-1 text-xs text-slate-400">Lower water position in frame</p>
      </section>
    </div>
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-white">24-hour Water Y Trend</h2>
        <span className="text-xs text-slate-400">{history.length} readings</span>
      </div>
      {history.length ? <>
        <p className="mt-2 text-xs text-slate-400">{formatUmTime(history[0].timestamp)} to {formatUmTime(history.at(-1)!.timestamp)} (MYT)</p>
        <div role="img" aria-label={`Water Y trend. ${history.length} readings, minimum ${minimum}, maximum ${maximum}. Full readings are available in Display Log.`}
          className="mt-6 flex h-64 items-end gap-1 border-b border-slate-700">
          {bars.map(event => <div key={event.id}
            className={`min-w-0 flex-1 rounded-t ${event.status === "DANGER" ? "bg-red-500" : event.status === "NORMAL" ? "bg-blue-500" : "bg-amber-500"}`}
            style={{ height: `${15 + ((event.waterline_y_px - minimum!) / Math.max(1, maximum! - minimum!)) * 80}%` }}
            title={`${formatUmTime(event.timestamp)} · Y ${event.waterline_y_px} · ${event.status}`} />)}
        </div>
        <p className="mt-4 text-sm text-slate-400">Normal: blue. Rising / Warning: amber. Danger: red.</p>
      </> : <p className="py-20 text-center text-sm text-slate-400">{isLoading ? "Loading water-level history..." : error ?? "No UM readings in the past 24 hours."}</p>}
      <p className="mt-3 text-xs text-slate-400">Water Y values are pixel coordinates, not measurements in metres.</p>
    </section>
  </>;
}

export function UmDisplayLog() {
  const { events: history, isLoading, error } = useUmData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<UmWaterStatus | "ALL">("ALL");
  const events = history.filter(event => (status === "ALL" || status === event.status) &&
    `${event.camera_id} ${event.device_id} ${event.status} ${event.message} ${event.trigger}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <div className="flex justify-end"><UmConnectionStatus /></div>
    <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row">
      <label className="flex flex-1 flex-col gap-2 text-sm text-slate-400">Search events
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search camera, status or message"
          className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 focus:outline-2 focus:outline-blue-500" />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-400">Status
        <select value={status} onChange={event => setStatus(event.target.value as UmWaterStatus | "ALL")}
          className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 focus:outline-2 focus:outline-blue-500">
          <option value="ALL">All statuses</option><option value="NORMAL">Normal</option><option value="RISING">Rising</option><option value="WARNING">Warning</option><option value="DANGER">Danger</option>
        </select>
      </label>
    </div>
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap justify-between gap-3 border-b border-slate-800 px-5 py-4 text-sm">
        <h2 className="font-semibold text-white">Event history</h2><span className="text-slate-400" aria-live="polite">{events.length} of {history.length} records</span>
      </div>
      {events.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <caption className="sr-only">Universiti Malaya water-level events</caption>
        <thead className="bg-slate-950/60 text-xs uppercase text-slate-400"><tr>{["Date & time (MYT)", "Camera", "Status", "Water Y", "Level code", "Trigger", "Message"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-800">{events.map(event => <tr key={event.id} className="hover:bg-slate-800/40">
          <td className="whitespace-nowrap px-4 py-3 text-slate-400"><time dateTime={event.timestamp}>{formatUmTime(event.timestamp)}</time></td>
          <td className="whitespace-nowrap px-4 py-3 text-slate-200">{event.camera_id}</td>
          <td className={`px-4 py-3 font-medium ${umStatusClass(event.status)}`}>{event.status}</td>
          <td className="px-4 py-3 text-slate-300">{event.waterline_y_px}</td>
          <td className="px-4 py-3 text-slate-400">{event.level_code}</td><td className="px-4 py-3 text-slate-400">{event.trigger}</td>
          <td className="min-w-64 px-4 py-3 text-slate-400">{event.message}</td>
        </tr>)}</tbody>
      </table></div> : <p className="p-12 text-center text-sm text-slate-400">{isLoading ? "Loading UM events..." : error ?? (history.length ? "No events match your filters." : "Waiting for UM inference events.")}</p>}
    </section>
  </>;
}
