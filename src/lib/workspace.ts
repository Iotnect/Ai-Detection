export const NEOVISION_HOSTNAME = "neovision.iotnect.com";
export const UM_HOSTNAME = "um.iotnect.com";

export function isNeoVisionHost(hostname: string): boolean {
  return hostname.toLowerCase() === NEOVISION_HOSTNAME;
}

export function isUmHost(hostname: string): boolean {
  return hostname.toLowerCase() === UM_HOSTNAME;
}

export function isPublicDemoRoute(hostname: string, pathname: string): boolean {
  return isNeoVisionHost(hostname) &&
    (pathname === "/" || pathname === "/um" || pathname.startsWith("/um/"));
}
