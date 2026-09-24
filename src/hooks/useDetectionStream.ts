"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export interface LiveDetection {
  camera_id: string;
  raw_y: number;
  smoothed_y: number;
  status: string;
  event_type: string;
  confidence?: number | null;
  timestamp: string;
  message: string;
  image_url?: string | null;
  received_at: string;
}

type ConnectionState = "disabled" | "connecting" | "online" | "offline";

export function useDetectionStream() {
  const [detections, setDetections] = useState<LiveDetection[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disabled");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const client = supabase;

    if (!apiUrl || !client) return;

    let socket: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = async () => {
      setConnectionState("connecting");
      const { data } = await client.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken || stopped) {
        setConnectionState("offline");
        return;
      }

      const ticketResponse = await fetch(`${apiUrl}/api/v1/ws-ticket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const ticket = (await ticketResponse.json()) as { token?: string };

      if (!ticketResponse.ok || !ticket.token || stopped) {
        setConnectionState("offline");
        retryTimer = setTimeout(() => void connect(), 3_000);
        return;
      }

      const url = new URL("/api/v1/ws/detections", apiUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("ticket", ticket.token);
      socket = new WebSocket(url);

      socket.addEventListener("open", () => setConnectionState("online"));
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data) as {
          type: string;
          data?: LiveDetection | LiveDetection[];
        };

        if (message.type === "snapshot" && Array.isArray(message.data)) {
          setDetections(message.data);
        }

        if (message.type === "detection" && message.data && !Array.isArray(message.data)) {
          const detection = message.data;
          setDetections((current) => [
            detection,
            ...current.filter(
              (currentDetection) =>
                currentDetection.camera_id !== detection.camera_id,
            ),
          ]);
        }
      });
      socket.addEventListener("close", () => {
        if (stopped) return;
        setConnectionState("offline");
        retryTimer = setTimeout(() => void connect(), 3_000);
      });
      socket.addEventListener("error", () => socket?.close());
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return { detections, connectionState };
}
