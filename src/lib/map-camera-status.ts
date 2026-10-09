import type { CameraStatusRecord } from "@/hooks/useCameraStatuses";

/** DSS-discovered cameras have generated database codes; their names carry
 * the client-facing MBS-KDN identifier. Prefer explicit codes when available.
 * Never choose arbitrarily between duplicate names or match C1 to C10.
 */
export function findMapCameraStatus(cameras: CameraStatusRecord[], code: string) {
  const expected = code.trim().toUpperCase();
  const exact = cameras.find((camera) => camera.code.trim().toUpperCase() === expected);
  if (exact) return exact;

  const matches = cameras.filter((camera) =>
    camera.name.trim().match(/^(MBS-KDN-C\d+)(?=\s|$)/i)?.[1].toUpperCase() === expected,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function cameraConnectivityMessage(camera: CameraStatusRecord) {
  const time = camera.last_seen_at
    ? new Date(camera.last_seen_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })
    : null;
  if (camera.status === "online") return time ? `Online now · Last checked ${time} (MYT)` : "Online now";
  return time ? `Last online ${time} (MYT)` : "No online activity recorded yet";
}
