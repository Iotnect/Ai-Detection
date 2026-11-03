export const NEOVISION_HOSTNAME = "neovision.iotnect.com";

export function isNeoVisionHost(hostname: string): boolean {
  return hostname.toLowerCase() === NEOVISION_HOSTNAME;
}

export function isPublicDemoRoute(hostname: string, pathname: string): boolean {
  return isNeoVisionHost(hostname) &&
    (pathname === "/" || pathname === "/um" || pathname.startsWith("/um/"));
}
