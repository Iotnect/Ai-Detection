export function isMapStream(path: string): boolean {
  return /^status-[a-f0-9]{8}-[a-z0-9-]+$/.test(path);
}
