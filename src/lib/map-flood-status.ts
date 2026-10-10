import type { LiveDetection } from "@/hooks/useDetectionStream";

export function findMapFloodDetection(detections: LiveDetection[], code: string) {
  const expected = code.trim().toUpperCase();
  return detections
    .filter((detection) => detection.camera_id.trim().toUpperCase() === expected)
    .reduce<LiveDetection | undefined>((latest, detection) => {
      const time = Date.parse(detection.timestamp);
      if (!Number.isFinite(time)) return latest;
      return !latest || time > Date.parse(latest.timestamp) ? detection : latest;
    }, undefined);
}

export function mapFloodStatus(detection?: LiveDetection): "rising" | "danger" | "normal" | "unknown" {
  switch (detection?.status.trim().toUpperCase()) {
    case "RISING":
    case "WARNING": return "rising";
    case "DANGER": return "danger";
    case "NORMAL": return "normal";
    default: return "unknown";
  }
}
