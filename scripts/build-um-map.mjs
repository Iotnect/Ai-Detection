import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const bounds = [3.112629, 101.655867, 3.124629, 101.667867];
const box = bounds.join(",");
const query = `[out:json][timeout:35];(way[highway](${box});way[building](${box});way[waterway](${box});way[natural=water](${box}););out geom;`;
let data;
const endpoints = [
  `https://api.openstreetmap.org/api/0.6/map?bbox=${[bounds[1], bounds[0], bounds[3], bounds[2]].join(",")}`,
  `https://overpass-api.de/api/interpreter?${new URLSearchParams({ data: query })}`,
];
for (const endpoint of endpoints) {
  try {
    const { stdout } = await run(process.platform === "win32" ? "curl.exe" : "curl", [
      "-fsSL", "--connect-timeout", "10", "--max-time", "40",
      "-A", "NeoVision-UM-Map/1.0", "-H", "Accept: application/json", endpoint,
    ], { maxBuffer: 20 * 1024 * 1024, timeout: 45_000 });
    data = JSON.parse(stdout);
    if (data.remark || !data.elements?.length) throw new Error(data.remark || "Empty OSM extract");
    break;
  } catch (error) {
    console.error(`${endpoint}: ${error.message}`);
  }
}
if (!data?.elements?.length || data.remark) throw new Error("Unable to fetch a complete OSM extract");

const nodes = new Map(data.elements.filter(element => element.type === "node").map(node => [node.id, node]));
const features = data.elements.flatMap(way => {
  if (way.type !== "way") return [];
  const tags = way.tags || {};
  if (!tags.highway && !tags.building && !tags.waterway && tags.natural !== "water") return [];
  const geometry = way.geometry || (way.nodes || []).map(id => nodes.get(id));
  if (geometry.some(point => !point)) return [];
  const coordinates = geometry.map(point => [point.lon, point.lat]);
  if (coordinates.length < 2) return [];
  const closed = coordinates.length >= 4 && coordinates[0][0] === coordinates.at(-1)[0] && coordinates[0][1] === coordinates.at(-1)[1];
  const polygon = closed && (tags.building || tags.natural === "water");
  return [{ type: "Feature", properties: {
    osm_id: way.id, name: tags.name || tags.ref || "", highway: tags.highway || "",
    building: tags.building || "", waterway: tags.waterway || "", natural: tags.natural || "",
  }, geometry: { type: polygon ? "Polygon" : "LineString", coordinates: polygon ? [coordinates] : coordinates } }];
});
const output = {
  type: "FeatureCollection", features, source: "OpenStreetMap contributors", license: "ODbL-1.0",
  timestamp: data.osm3s?.timestamp_osm_base, bounds,
  coverage_note: "Display coverage around user-provided camera coordinates, not an official campus boundary.",
};
await mkdir(new URL("../public/maps/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/maps/um-context.geojson", import.meta.url), JSON.stringify(output));
console.log(`Saved ${features.length} OSM features for the UM camera map`);
