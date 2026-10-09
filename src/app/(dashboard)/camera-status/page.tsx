"use client";

import { RefreshCw } from "lucide-react";
import NilaiMap from "@/components/map/NilaiMap";

import { useCameraStatuses } from "@/hooks/useCameraStatuses";

export default function CameraStatusPage() {
  const { cameras, isLoading, error, refresh } = useCameraStatuses();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            DSS camera connectivity for MBS
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <NilaiMap cameras={cameras} statusesLoading={isLoading} statusesError={error} />
    </div>
  );
}
