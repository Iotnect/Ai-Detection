"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

import { authenticatedFetch } from "@/lib/authenticated-fetch";

interface HlsPlayerProps {
  src: string;
  className?: string;
  ariaLabel: string;
  onClick?: () => void;
}

export default function HlsPlayer({
  src,
  className,
  ariaLabel,
  onClick,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    let hls: Hls | undefined;
    let cancelled = false;
    let generation = 0;
    let nativeRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    let nativeRetryTimer: ReturnType<typeof setTimeout> | undefined;

    const stopPlayer = () => {
      generation += 1;
      clearTimeout(nativeRefreshTimer);
      nativeRefreshTimer = undefined;
      clearTimeout(nativeRetryTimer);
      nativeRetryTimer = undefined;
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
      hls?.destroy();
      hls = undefined;

      if (
        cancelled ||
        document.visibilityState === "hidden" ||
        currentGeneration !== generation
      ) {
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setFailed(true);
        return;
      }

      try {
        const streamPath = new URL(src).pathname.split("/").filter(Boolean)[0];

        if (!streamPath) {
          setFailed(true);
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

        if (
          !response.ok ||
          !ticket.token ||
          cancelled ||
          currentGeneration !== generation
        ) {
          setFailed(true);
          scheduleReconnect();
          return;
        }

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
          const player = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 5,
            maxLiveSyncPlaybackRate: 1.5,
          });
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

              if (!error.fatal && statusCode !== 401 && statusCode !== 404) {
                return;
              }

              setFailed(true);
              player.destroy();
              hls = undefined;
              scheduleReconnect();
              return;
            }

            if (!error.fatal) return;

            if (error.type === Hls.ErrorTypes.MEDIA_ERROR) {
              player.recoverMediaError();
              return;
            }

            setFailed(true);
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

        setFailed(true);
      } catch {
        setFailed(true);
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
        stopPlayer();
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.removeEventListener("play", resumeAtLiveEdge);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", scheduleNativeReconnect);
      video.removeEventListener("stalled", handleStalled);
      stopPlayer();
    };
  }, [src]);

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
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/95 px-6 text-center text-sm text-slate-400">
          Live stream is temporarily unavailable. The player will reconnect after the relay recovers.
        </div>
      )}
    </div>
  );
}
