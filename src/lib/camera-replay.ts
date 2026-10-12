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
