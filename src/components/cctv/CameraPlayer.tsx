"use client";

import { useCallback, useEffect, useState } from "react";
import HlsPlayer from "@/components/cctv/HlsPlayer";
import { shouldReplayCamera } from "@/lib/camera-replay";

interface CameraPlayerProps {
  src?: string;
  cameraCode: string;
  status?: string;
  className?: string;
  ariaLabel: string;
  targetLatencySeconds?: number;
  liveLabel?: string;
  onClick?: () => void;
  onUnavailable?: () => void;
}

export default function CameraPlayer({
  src, cameraCode, status, className, ariaLabel, targetLatencySeconds,
  liveLabel = "LIVE", onClick, onUnavailable,
}: CameraPlayerProps) {
  const [hostname, setHostname] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => setHostname(window.location.hostname), []);
  useEffect(() => setFailed(false), [src]);
  const handleUnavailable = useCallback(() => {
    setFailed(true);
    onUnavailable?.();
  }, [onUnavailable]);
  const handleAvailable = useCallback(() => setFailed(false), []);
  const replay = shouldReplayCamera(hostname, cameraCode, status, !src || failed);

  return (
    <div className="relative h-full w-full bg-black">
      {/* Keep reconnecting behind the replay so live playback can recover. */}
      {src && (
        <div className="h-full w-full" style={{ display: replay ? "none" : undefined }}>
          <HlsPlayer
            src={src}
            className={className}
            ariaLabel={ariaLabel}
            targetLatencySeconds={targetLatencySeconds}
            onClick={onClick}
            onUnavailable={handleUnavailable}
            onAvailable={handleAvailable}
          />
        </div>
      )}
      {replay ? (
        <video
          className={`camera-video ${className || ""}`}
          src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/camera-1.v2.mp4`}
          aria-label={`${cameraCode} recorded demo replay`}
          onClick={onClick}
          autoPlay controls={false} loop muted playsInline preload="metadata"
        />
      ) : !src ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
          Live stream is unavailable.
        </div>
      ) : null}
      {(src || replay) && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/65 px-2.5 py-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[11px] font-semibold tracking-wide text-white">
            {replay ? "DEMO REPLAY" : failed ? "STREAM UNAVAILABLE" : liveLabel}
          </span>
        </div>
      )}
    </div>
  );
}
