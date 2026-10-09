"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Download,
  FileText,
  TrendingUp,
} from "lucide-react";

import type { LiveDetection } from "@/hooks/useDetectionStream";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { exportFloodAlertReport } from "@/lib/report-pdf";

const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";
const MAX_REPORT_EVENTS = 10_000;

function malaysiaDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function initialFromDate(): string {
  return malaysiaDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000));
}

function statusClassName(status: string): string {
  return status.toUpperCase() === "DANGER"
    ? "bg-red-500/10 text-red-400"
    : "bg-amber-500/10 text-amber-400";
}

export default function ReportingPage() {
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(() => malaysiaDateKey(new Date()));
  const [events, setEvents] = useState<LiveDetection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const risingCount = events.filter(
    (event) => event.status.toUpperCase() === "RISING",
  ).length;
  const dangerCount = events.filter(
    (event) => event.status.toUpperCase() === "DANGER",
  ).length;
  const cameraCount = new Set(events.map((event) => event.camera_id)).size;

  const loadReport = async () => {
    if (!fromDate || !toDate || fromDate > toDate) {
      setError("Select a valid reporting date range.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!apiUrl) {
      setError("Backend API is not configured.");
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const query = new URLSearchParams({
        limit: String(MAX_REPORT_EVENTS),
        from: new Date(`${fromDate}T00:00:00+08:00`).toISOString(),
        to: new Date(`${toDate}T23:59:59.999+08:00`).toISOString(),
        statuses: "RISING,DANGER",
      });
      const response = await authenticatedFetch(
        `${apiUrl}/api/v1/detections/history?${query.toString()}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        data?: LiveDetection[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Unable to load report data.");
      }

      const alerts = (body.data ?? []).filter((event) =>
        ["RISING", "DANGER"].includes(event.status.toUpperCase()),
      );
      setEvents(alerts);
      setHasLoaded(true);

      if (alerts.length === MAX_REPORT_EVENTS) {
        setError(
          "The report reached 10,000 alerts. Use a shorter date range to ensure a complete report.",
        );
      }
    } catch (requestError) {
      setEvents([]);
      setHasLoaded(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load report data.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = async () => {
    setIsExporting(true);
    setError(undefined);

    try {
      await exportFloodAlertReport({ fromDate, toDate, events });
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to generate the PDF report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Reporting</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Generate MBS flood alert reports for rising and danger events
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center gap-2 text-white">
          <CalendarRange size={18} className="text-blue-400" />
          <h2 className="font-semibold">Reporting period</h2>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-slate-400">
            From date
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setHasLoaded(false);
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-blue-500"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-slate-400">
            To date
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={malaysiaDateKey(new Date())}
              onChange={(event) => {
                setToDate(event.target.value);
                setHasLoaded(false);
              }}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/50 bg-blue-600/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText size={16} />
            {isLoading ? "Loading..." : "Generate report"}
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!hasLoaded || isLoading || isExporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={16} />
            {isExporting ? "Preparing PDF..." : "Export PDF"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Only events classified as RISING or DANGER are included in the report.
        </p>
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Total Alerts</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {hasLoaded ? events.length : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-amber-400">
            <TrendingUp size={16} />
            <p className="text-sm">Rising</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">
            {hasLoaded ? risingCount : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <p className="text-sm">Danger</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">
            {hasLoaded ? dangerCount : "--"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Cameras Affected</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {hasLoaded ? cameraCount : "--"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm">
          <span className="font-medium text-white">Alert preview</span>
          <span className="text-slate-500">
            {hasLoaded ? `${events.length} records` : "Select a reporting period"}
          </span>
        </div>

        {!hasLoaded ? (
          <p className="p-10 text-center text-sm text-slate-400">
            Generate a report to preview rising and danger events.
          </p>
        ) : !events.length ? (
          <p className="p-10 text-center text-sm text-emerald-400">
            No rising or danger events were recorded in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date &amp; time</th>
                  <th className="px-4 py-3">Camera</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Water Y</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {events.slice(0, 100).map((event) => (
                  <tr
                    key={`${event.camera_id}-${event.received_at}`}
                    className="hover:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                      {new Date(event.timestamp).toLocaleString("en-MY")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-200">
                      {event.camera_id}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {event.camera_location || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassName(event.status)}`}
                      >
                        {event.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{event.smoothed_y}</td>
                    <td className="min-w-64 px-4 py-3 text-slate-400">
                      {event.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {events.length > 100 ? (
              <p className="border-t border-slate-800 px-4 py-3 text-xs text-slate-500">
                Showing the first 100 records. The PDF includes all {events.length} records.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
