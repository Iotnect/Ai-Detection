/** Retain a decoded frame over the video while its native player buffers.
 * Capture frames locally; no image export or extra network requests are used.
 */
export function holdVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  onHold: (held: boolean) => void,
) {
  let hasFrame = false;
  let held = false;
  let disposed = false;
  let frameRequest: number | undefined;
  const context = canvas.getContext("2d");
  const supportsFrameCallback = typeof video.requestVideoFrameCallback === "function";

  canvas.width = 0;
  canvas.height = 0;
  onHold(false);

  function capture() {
    if (disposed || !context || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return hasFrame;
    // Bound the snapshot cost for high-resolution camera feeds.
    const scale = Math.min(1, 1280 / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    try {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      hasFrame = true;
    } catch {
      // Keep the previous snapshot if a frame is unavailable during a reset.
    }
    return hasFrame;
  }

  function freeze() {
    if (disposed) return;
    capture();
    if (hasFrame && !held) {
      held = true;
      onHold(true);
    }
  }

  function showNewFrame() {
    if (!disposed && held && !video.paused && video.readyState >= 2) {
      held = false;
      onHold(false);
    }
  }

  function onFrame() {
    if (disposed) return;
    capture();
    showNewFrame();
    frameRequest = video.requestVideoFrameCallback(onFrame);
  }

  const onStalled = () => {
    if (video.readyState < 3) freeze();
  };
  const onTimeUpdate = () => {
    if (!video.paused && video.readyState >= 2) {
      capture();
      showNewFrame();
    }
  };

  video.addEventListener("waiting", freeze);
  video.addEventListener("seeking", freeze);
  video.addEventListener("error", freeze);
  video.addEventListener("stalled", onStalled);
  video.addEventListener("pause", capture);
  if (supportsFrameCallback) frameRequest = video.requestVideoFrameCallback(onFrame);
  else video.addEventListener("timeupdate", onTimeUpdate);

  return {
    freeze,
    dispose() {
      disposed = true;
      if (frameRequest !== undefined) video.cancelVideoFrameCallback(frameRequest);
      video.removeEventListener("waiting", freeze);
      video.removeEventListener("seeking", freeze);
      video.removeEventListener("error", freeze);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("pause", capture);
      video.removeEventListener("timeupdate", onTimeUpdate);
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
