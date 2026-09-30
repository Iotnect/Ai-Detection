"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";

import { useDetectionHistory } from "@/hooks/useDetectionHistory";

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["NORMAL", "RISING", "DANGER"] as const;
const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

function malaysiaDateKey(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function statusClassName(status: string): string {
  switch (status.toUpperCase()) {
    case "DANGER":
      return "bg-red-500/10 text-red-400";
    case "RISING":
    case "WARNING":
      return "bg-amber-500/10 text-amber-400";
    default:
      return "bg-emerald-500/10 text-emerald-400";
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function displayDate(date: string): string {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DisplayLogPage() {
  const { events, isLoading, error, refresh } = useDetectionHistory(1_000);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [exportDate, setExportDate] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEvents.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredEvents]);
  const availableExportDates = useMemo(
    () =>
      Array.from(new Set(events.map((event) => malaysiaDateKey(event.timestamp))))
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left)),
    [events],
  );
  const exportEvents = useMemo(
    () => filteredEvents.filter((event) => malaysiaDateKey(event.timestamp) === exportDate),
    [exportDate, filteredEvents],
  );

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setExportDate((current) =>
      current && availableExportDates.includes(current)
        ? current
        : (availableExportDates[0] ?? ""),
    );
  }, [availableExportDates]);

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
    const rows = exportEvents.map((event) => [
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
    anchor.download = `mbs-event-log-${exportDate}.csv`;
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
      document.text(
        `Date: ${new Date(`${exportDate}T00:00:00+08:00`).toLocaleDateString("en-MY")} | Exported: ${new Date().toLocaleString("en-MY")}`,
        14,
        22,
      );
      autoTable(document, {
        startY: 27,
        head: [["Time", "Camera", "Event", "Status", "Raw Y", "Smooth Y", "Confidence", "Message"]],
        body: exportEvents.map((event) => [
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
      document.save(`mbs-event-log-${exportDate}.pdf`);
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
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Export date
            <select
              value={exportDate}
              onChange={(event) => setExportDate(event.target.value)}
              disabled={!availableExportDates.length}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {!availableExportDates.length ? <option value="">No dates available</option> : null}
              {availableExportDates.map((date) => (
                <option key={date} value={date}>
                  {displayDate(date)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!exportDate || !exportEvents.length}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            title={exportEvents.length ? `Export ${exportEvents.length} records for ${exportDate}` : `No records for ${exportDate}`}
          >
            <Download size={16} /> Export CSV ({exportEvents.length})
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!exportDate || !exportEvents.length || isExportingPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            title={exportEvents.length ? `Export ${exportEvents.length} records for ${exportDate}` : `No records for ${exportDate}`}
          >
            <FileText size={16} />
            {isExportingPdf ? "Preparing..." : `Export PDF (${exportEvents.length})`}
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
            {STATUS_OPTIONS.map((eventStatus) => (
              <option key={eventStatus} value={eventStatus}>
                {eventStatus === "RISING" ? "Rising" : eventStatus === "DANGER" ? "Danger" : "Normal"}
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
                {paginatedEvents.map((event) => (
                  <tr key={`${event.camera_id}-${event.received_at}`} className="hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {new Date(event.timestamp).toLocaleString("en-MY")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-200">
                      {event.camera_id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{event.event_type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassName(event.status)}`}>
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

        {!isLoading && !error && filteredEvents.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredEvents.length)} of {filteredEvents.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span className="min-w-24 text-center text-slate-400">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage === pageCount}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
