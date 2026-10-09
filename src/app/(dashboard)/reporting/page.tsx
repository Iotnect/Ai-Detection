import { FileText } from "lucide-react";

export default function ReportingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Reporting</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Generate and review flood monitoring reports
        </p>
      </div>

      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          <FileText size={24} aria-hidden="true" />
        </div>
        <h2 className="mt-4 font-semibold text-white">Reporting workspace</h2>
        <p className="mt-1 max-w-md text-sm text-slate-400">
          Reporting tools and generated reports will be available here.
        </p>
      </div>
    </div>
  );
}
