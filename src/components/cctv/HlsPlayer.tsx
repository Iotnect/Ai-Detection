"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { holdVideoFrame } from "@/lib/hold-video-frame";

interface HlsPlayerProps {
  src: string;
  className?: string;
  ariaLabel: string;
  targetLatencySeconds?: number;
  onClick?: () => void;
  onUnavailable?: () => void;
}

export default function HlsPlayer({
  src,
  className,
  ariaLabel,
  targetLatencySeconds,
  onClick,
  onUnavailable,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [holdingFrame, setHoldingFrame] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = frameRef.current;

    if (!video || !canvas) return;
    setFailed(false);
    const retainedFrame = holdVideoFrame(video, canvas, setHoldingFrame);

    let hls: Hls | undefined;
    let cancelled = false;
    let generation = 0;
    let hiddenAt: number | undefined;
    let ticketExpiresAt = 0;
    let nativeRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let nativeRetryTimer: ReturnType<typeof setTimeout> | undefined;

    const markUnavailable = () => {
      if (cancelled) return;
      retainedFrame.freeze();
      setFailed(true);
      onUnavailable?.();
    };

    const stopPlayer = () => {
      generation += 1;
      clearTimeout(nativeRefreshTimer);
      nativeRefreshTimer = undefined;
      clearTimeout(nativeRetryTimer);
      nativeRetryTimer = undefined;
      retainedFrame.freeze();
      hls?.destroy();
      hls = undefined;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const scheduleReconnect = () => {
      if (cancelled || document.visibilityState === "hidden") return;

      clearTimeout(nativeRetryTimer);
      nativeRetryTimer = setTimeout(() => void attach(), 3_000);
    };

    const attach = async () => {
      const currentGeneration = ++generation;
      clearTimeout(nativeRefreshTimer);
      nativeRefreshTimer = undefined;

      if (
        cancelled ||
        document.visibilityState === "hidden" ||
        currentGeneration !== generation
      ) {
        return;
      }

      retainedFrame.freeze();
      hls?.destroy();
      hls = undefined;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

      if (!apiUrl) {
        markUnavailable();
        return;
      }

      try {
        const streamPath = new URL(src).pathname.split("/").filter(Boolean)[0];

        if (!streamPath) {
          markUnavailable();
          return;
        }

        const response = await authenticatedFetch(`${apiUrl}/api/v1/stream-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path: streamPath }),
        });
        const ticket = (await response.json()) as {
          token?: string;
          expiresIn?: number;
        };

        if (cancelled || currentGeneration !== generation) return;

        if (!response.ok || !ticket.token) {
          markUnavailable();
          scheduleReconnect();
          return;
        }

        ticketExpiresAt =
          Date.now() + Math.max(30, ticket.expiresIn ?? 300) * 1000;

        const playbackUrl = new URL(
          `/api/v1/hls/${encodeURIComponent(streamPath)}/index.m3u8`,
          apiUrl,
        );
        playbackUrl.searchParams.set("ticket", ticket.token);

        nativeRefreshTimer = setTimeout(
          () => void attach(),
          Math.max(30, (ticket.expiresIn ?? 300) - 30) * 1000,
        );

        if (Hls.isSupported()) {
          const player = new Hls(
            targetLatencySeconds
              ? {
                  enableWorker: true,
                  lowLatencyMode: false,
                  liveSyncDuration: targetLatencySeconds,
                  liveMaxLatencyDuration: targetLatencySeconds * 3,
                  maxBufferLength: Math.max(15, targetLatencySeconds * 3),
                }
              : {
                  enableWorker: true,
                  lowLatencyMode: true,
                  liveSyncDurationCount: 2,
                  liveMaxLatencyDurationCount: 5,
                  maxLiveSyncPlaybackRate: 1.5,
                },
          );
          hls = player;
          player.loadSource(playbackUrl.toString());
          player.attachMedia(video);
          player.on(Hls.Events.MANIFEST_PARSED, () => {
            if (hls !== player) return;
            setFailed(false);
            void video.play().catch(() => undefined);
          });
          player.on(Hls.Events.ERROR, (_event, error) => {
            if (hls !== player) return;

            if (error.type === Hls.ErrorTypes.NETWORK_ERROR) {
              const statusCode = error.response?.code;

              if (!error.fatal && statusCode !== 401) {
                return;
              }

              markUnavailable();
              player.destroy();
              hls = undefined;
              scheduleReconnect();
              return;
            }

            if (!error.fatal) return;

            if (error.type === Hls.ErrorTypes.MEDIA_ERROR) {
              retainedFrame.freeze();
              player.recoverMediaError();
              return;
            }

            markUnavailable();
            player.destroy();
            hls = undefined;
            scheduleReconnect();
          });
          return;
        }

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl.toString();
          void video.play().catch(() => undefined);
          return;
        }

        markUnavailable();
      } catch {
        if (cancelled || currentGeneration !== generation) return;
        markUnavailable();
        scheduleReconnect();
      }
    };

    const scheduleNativeReconnect = () => {
      if (!Hls.isSupported()) scheduleReconnect();
    };

    const resumeAtLiveEdge = () => {
      const livePosition = hls?.liveSyncPosition;

      if (livePosition !== null && livePosition !== undefined) {
        video.currentTime = livePosition;
      }
    };

    const handlePlaying = () => {
      clearTimeout(nativeRetryTimer);
      nativeRetryTimer = undefined;
      setFailed(false);
    };

    const handleStalled = () => {
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        scheduleNativeReconnect();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        clearTimeout(nativeRetryTimer);
        nativeRetryTimer = undefined;
        return;
      }

      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = undefined;

      // Browsers throttle timers and HLS requests in background tabs. If the
      // tab was hidden long enough, the player can still exist while every
      // manifest and segment URL inside it carries an expired stream ticket.
      // Recreate it with a fresh ticket instead of trying to resume stale HLS
      // state. Keep very short tab switches instant.
      const ticketNeedsRefresh =
        ticketExpiresAt === 0 || Date.now() >= ticketExpiresAt - 30_000;
      const backgroundPlaybackIsStale = hiddenFor >= 15_000;

      if (ticketNeedsRefresh || backgroundPlaybackIsStale) {
        void attach();
        return;
      }

      if (hls) {
        resumeAtLiveEdge();
        void video.play().catch(() => undefined);
        return;
      }

      if (video.currentSrc) {
        void video.play().catch(() => undefined);
        return;
      }

      void attach();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    video.addEventListener("play", resumeAtLiveEdge);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("error", scheduleNativeReconnect);
    video.addEventListener("stalled", handleStalled);
    void attach();

    return () => {
      cancelled = true;
      retainedFrame.dispose();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.removeEventListener("play", resumeAtLiveEdge);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", scheduleNativeReconnect);
      video.removeEventListener("stalled", handleStalled);
      stopPlayer();
    };
  }, [src, targetLatencySeconds, onUnavailable]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        className={className}
        aria-label={ariaLabel}
        onClick={onClick}
        autoPlay
        controls
        muted
        playsInline
      />
      <canvas
        ref={frameRef}
        aria-hidden="true"
        className={`${className || "h-full w-full object-contain"} pointer-events-none absolute inset-0 bg-black`}
        style={{ visibility: holdingFrame ? "visible" : "hidden" }}
      />
      {failed && !holdingFrame && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 px-6 text-center text-sm text-slate-400">
          Live stream is temporarily unavailable. The player will reconnect after the relay recovers.
        </div>
      )}
    </div>
  );
}
