"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type CameraConnectionStatus =
  | "online"
  | "offline"
  | "reconnecting"
  | "error";

export interface CameraStatusRecord {
  id: string;
  code: string;
  name: string;
  status: CameraConnectionStatus;
  last_seen_at: string | null;
}

export function useCameraStatuses() {
  const [cameras, setCameras] = useState<CameraStatusRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await supabase
        .from("cameras")
        .select("id, code, name, status, last_seen_at")
        .order("name", { ascending: true });

      if (queryError) throw queryError;

      setCameras((data ?? []) as CameraStatusRecord[]);
      setError(undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load camera statuses.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return { cameras, isLoading, error, refresh };
}
