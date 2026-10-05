"use client";

import { useEffect, useState } from "react";

import { authenticatedFetch } from "@/lib/authenticated-fetch";
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
    let connectionAttempt = 0;

    const clearRetry = () => {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    };

    const scheduleReconnect = (delay = 3_000) => {
      if (stopped) return;
      clearRetry();
      retryTimer = setTimeout(() => void connect(), delay);
    };

    const closeSocket = () => {
      const currentSocket = socket;
      socket = undefined;
      currentSocket?.close();
    };

    const connect = async () => {
      const attempt = ++connectionAttempt;
      clearRetry();
      setConnectionState("connecting");

      try {
        const ticketResponse = await authenticatedFetch(
          `${apiUrl}/api/v1/ws-ticket`,
          { method: "POST" },
        );
        const ticket = (await ticketResponse.json()) as { token?: string };

        if (stopped || attempt !== connectionAttempt) return;

        if (!ticketResponse.ok || !ticket.token) {
          setConnectionState("offline");
          scheduleReconnect();
          return;
        }

        const url = new URL("/api/v1/ws/detections", apiUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.searchParams.set("ticket", ticket.token);
        const nextSocket = new WebSocket(url);
        socket = nextSocket;

        nextSocket.addEventListener("open", () => {
          if (socket === nextSocket) setConnectionState("online");
        });
        nextSocket.addEventListener("message", (event) => {
          if (socket !== nextSocket) return;

          const message = JSON.parse(event.data) as {
            type: string;
            data?: LiveDetection | LiveDetection[];
          };

          if (message.type === "snapshot" && Array.isArray(message.data)) {
            setDetections(message.data);
          }

          if (
            message.type === "detection" &&
            message.data &&
            !Array.isArray(message.data)
          ) {
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
        nextSocket.addEventListener("close", () => {
          if (socket === nextSocket) socket = undefined;
          if (stopped || attempt !== connectionAttempt) return;
          setConnectionState("offline");
          scheduleReconnect();
        });
        nextSocket.addEventListener("error", () => nextSocket.close());
      } catch {
        if (stopped || attempt !== connectionAttempt) return;
        setConnectionState("offline");
        scheduleReconnect();
      }
    };

    void connect();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (stopped) return;

      if (event === "SIGNED_OUT") {
        connectionAttempt += 1;
        clearRetry();
        closeSocket();
        setConnectionState("offline");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        connectionAttempt += 1;
        clearRetry();
        closeSocket();
        void connect();
      }
    });

    return () => {
      stopped = true;
      connectionAttempt += 1;
      subscription.unsubscribe();
      clearRetry();
      closeSocket();
    };
  }, []);

  return { detections, connectionState };
}
