"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";

export default function MapAttribution() {
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      // Keep the licence available while someone is reading or using it.
      if (container.current?.contains(document.activeElement) || container.current?.matches(":hover")) return;
      setExpanded(false);
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div ref={container} className="absolute bottom-3 right-3 z-[600] flex flex-col items-end gap-2">
      {expanded && (
        <div id={panelId} className="w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-xs text-slate-300 shadow-lg" role="region" aria-label="Map data attribution">
          <div className="flex items-start justify-between gap-2">
            <p className="leading-5">&copy; <a className="text-sky-400 underline underline-offset-2" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></p>
            <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400" aria-label="Collapse map credit" onClick={() => {
              setExpanded(false);
              container.current?.querySelector<HTMLButtonElement>("[data-credit-toggle]")?.focus();
            }}><X size={14} /></button>
          </div>
          <p className="mt-1 leading-5">Map data licensed under the <a className="text-sky-400 underline underline-offset-2" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">Open Database License (ODbL)</a>.</p>
        </div>
      )}
      <button type="button" data-credit-toggle aria-label={expanded ? "Collapse map credit" : "Show map credit and licence"} aria-expanded={expanded} aria-controls={expanded ? panelId : undefined} title="Map credit and licence" onClick={() => setExpanded((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-600 bg-slate-950 text-slate-300 shadow-lg hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400"><Info size={18} /></button>
    </div>
  );
}
