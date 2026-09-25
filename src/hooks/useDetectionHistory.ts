"use client";

import { useCallback, useEffect, useState } from "react";

import type { LiveDetection } from "@/hooks/useDetectionStream";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export function useDetectionHistory(limit = 500) {
  const [events, setEvents] = useState<LiveDetection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError("Backend API is not configured.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch(
        `${apiUrl}/api/v1/detections/history?limit=${limit}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        data?: LiveDetection[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Unable to load event history.");
      }

      setEvents(body.data ?? []);
      setError(undefined);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load event history.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

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

  return { events, isLoading, error, refresh };
}
