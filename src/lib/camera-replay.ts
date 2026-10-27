export const demoReplaySources = {
  original: "/neovision-demo-1015.mp4",
  ai: "/neovision-demo-ai.mp4",
} as const;

export type CameraStreamMode = keyof typeof demoReplaySources;

export function shouldReplayCamera(
  hostname: string,
  cameraCode: string,
  status: string | undefined,
  streamUnavailable: boolean,
) {
  return hostname.toLowerCase() === "neovision.iotnect.com"
    && cameraCode === "MBS-KDN-C1"
    && (streamUnavailable || status === "offline" || status === "reconnecting" || status === "error");
}
