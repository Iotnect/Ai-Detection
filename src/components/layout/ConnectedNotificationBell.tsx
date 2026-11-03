"use client";

import { useDetectionStream } from "@/hooks/useDetectionStream";
import { NotificationBell } from "./Topbar";

export default function ConnectedNotificationBell() {
  const { detections } = useDetectionStream();
  return <NotificationBell compact detections={detections} />;
}
