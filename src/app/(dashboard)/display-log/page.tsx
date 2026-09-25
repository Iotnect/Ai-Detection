"use client";

import { useMemo, useState } from "react";
import { Download, FileText, RefreshCw, Search } from "lucide-react";

import { useDetectionHistory } from "@/hooks/useDetectionHistory";

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function fileDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DisplayLogPage() {
  const { events, isLoading, error, refresh } = useDetectionHistory(1_000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const statuses = useMemo(
    () => Array.from(new Set(events.map((event) => event.status.toUpperCase()))),
    [events],
  );
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return events.filter((event) => {
      const matchesStatus =
        status === "ALL" || event.status.toUpperCase() === status;
      const matchesQuery =
        !normalizedQuery ||
        [event.camera_id, event.event_type, event.message, event.status]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [events, query, status]);

  const exportCsv = () => {
    const header = [
      "Timestamp",
      "Camera",
      "Event Type",
      "Status",
      "Raw Y",
      "Smoothed Y",
      "Confidence",
      "Message",
    ];
    const rows = filteredEvents.map((event) => [
      event.timestamp,
      event.camera_id,
      event.event_type,
      event.status,
      event.raw_y,
      event.smoothed_y,
      event.confidence ?? "",
      event.message,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mbs-event-log-${fileDate()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    setIsExportingPdf(true);

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const document = new jsPDF({ orientation: "landscape" });

      document.setFontSize(16);
      document.text("MBS-KDN Flood Detection Event Log", 14, 16);
      document.setFontSize(9);
      document.text(`Exported: ${new Date().toLocaleString("en-MY")}`, 14, 22);
      autoTable(document, {
        startY: 27,
        head: [["Time", "Camera", "Event", "Status", "Raw Y", "Smooth Y", "Confidence", "Message"]],
        body: filteredEvents.map((event) => [
          new Date(event.timestamp).toLocaleString("en-MY"),
          event.camera_id,
          event.event_type,
          event.status,
          String(event.raw_y),
          String(event.smoothed_y),
          event.confidence == null ? "-" : `${Math.round(event.confidence * 100)}%`,
          event.message,
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      document.save(`mbs-event-log-${fileDate()}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Display Log</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Historical water-level events for MBS-KDN-C1
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!filteredEvents.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!filteredEvents.length || isExportingPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText size={16} />
            {isExportingPdf ? "Preparing..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <span className="sr-only">Search event log</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search camera, status or message"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            {statuses.map((eventStatus) => (
              <option key={eventStatus} value={eventStatus}>
                {eventStatus}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm">
          <span className="font-medium text-white">Event history</span>
          <span className="text-slate-500">{filteredEvents.length} records</span>
        </div>

        {isLoading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading events...</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-400">{error}</p>
        ) : !filteredEvents.length ? (
          <p className="p-8 text-center text-sm text-slate-400">No matching events.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date &amp; time</th>
                  <th className="px-4 py-3">Camera</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Water Y</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEvents.map((event) => (
                  <tr key={`${event.camera_id}-${event.received_at}`} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {new Date(event.timestamp).toLocaleString("en-MY")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-200">
                      {event.camera_id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{event.event_type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${event.status.toUpperCase() === "NORMAL" ? "bg-emerald-500/10 text-emerald-400" : event.status.toUpperCase() === "DANGER" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{event.smoothed_y}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {event.confidence == null ? "-" : `${Math.round(event.confidence * 100)}%`}
                    </td>
                    <td className="min-w-64 px-4 py-3 text-slate-400">{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
