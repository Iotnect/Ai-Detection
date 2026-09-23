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
    let accessToken: string | undefined;
    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token;
    });

    const attach = async () => {
      setFailed(false);
      const { data } = (await supabase?.auth.getSession()) ?? {
        data: { session: null },
      };
      accessToken = data.session?.access_token;

      if (cancelled) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          liveSyncDurationCount: 3,
          xhrSetup: (request) => {
            if (accessToken) {
              request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            }
          },
        });

        hls.loadSource(src);
        hls.attachMedia(video);
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
        video.src = src;
        return;
      }

      setFailed(true);
    };

    void attach();

    return () => {
      cancelled = true;
      authSubscription?.data.subscription.unsubscribe();
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
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
