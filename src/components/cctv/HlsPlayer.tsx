"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

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
    let accessToken: string | undefined;
    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token;
    });

    const stopPlayer = () => {
      generation += 1;
      hls?.destroy();
      hls = undefined;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const attach = async () => {
      const currentGeneration = ++generation;
      setFailed(false);
      const { data } = (await supabase?.auth.getSession()) ?? {
        data: { session: null },
      };
      accessToken = data.session?.access_token;

      if (
        cancelled ||
        document.visibilityState === "hidden" ||
        currentGeneration !== generation
      ) {
        return;
      }

      if (Hls.isSupported()) {
        hls?.destroy();
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          maxLiveSyncPlaybackRate: 1.5,
          xhrSetup: (request) => {
            if (accessToken) {
              request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            }
          },
        });

        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined);
        });
        hls.on(Hls.Events.ERROR, (_event, error) => {
          if (!error.fatal) return;

          if (error.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
            return;
          }

          if (error.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
            return;
          }

          setFailed(true);
          hls?.destroy();
        });
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl") && !accessToken) {
        setFailed(true);
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl") && accessToken) {
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

          const response = await fetch(`${apiUrl}/api/v1/stream-ticket`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ path: streamPath }),
          });
          const ticket = (await response.json()) as { token?: string };

          if (
            !response.ok ||
            !ticket.token ||
            cancelled ||
            currentGeneration !== generation
          ) {
            setFailed(true);
            return;
          }

          const nativeUrl = new URL(src);
          nativeUrl.searchParams.set("token", ticket.token);
          video.src = nativeUrl.toString();
          void video.play().catch(() => undefined);
          return;
        } catch {
          setFailed(true);
          return;
        }
      }

      setFailed(true);
    };

    const resumeAtLiveEdge = () => {
      const livePosition = hls?.liveSyncPosition;

      if (livePosition !== null && livePosition !== undefined) {
        video.currentTime = livePosition;
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
    void attach();

    return () => {
      cancelled = true;
      authSubscription?.data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.removeEventListener("play", resumeAtLiveEdge);
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
