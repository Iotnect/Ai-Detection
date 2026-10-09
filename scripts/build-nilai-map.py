"""Build bundled Nilai roads. Requires Python shapely (pip install shapely).

Coverage is a DRAFT display rectangle, not an official administrative boundary.
Run with --download to refresh OSM data, or reuse tmp/seremban-roads-raw.json
(the development cache also contains roads outside Nilai, which are clipped).
"""
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request
from shapely.geometry import LineString, box, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/maps"
DEST.mkdir(parents=True, exist_ok=True)
boundary_path = DEST / "nilai-boundary.geojson"
if not boundary_path.exists():
    # Display coverage over Nilai, not an official administrative boundary.
    boundary = {"type":"Feature", "properties":{
        "name":"Nilai review area", "status":"draft",
        "source":"Nilai display coverage rectangle; not an official administrative boundary",
    }, "geometry":mapping(box(101.755,2.765,101.925,2.855))}
    boundary_path.write_text(json.dumps(boundary, separators=(",",":")), encoding="utf-8")
boundary = json.loads(boundary_path.read_text(encoding="utf-8"))
polygon = shape(boundary["geometry"])
if not polygon.is_valid:
    raise ValueError("Boundary polygon is invalid; correct its geometry before clipping roads")
raw_path = ROOT / "tmp/seremban-roads-raw.json"
if "--download" in sys.argv or not raw_path.exists():
    west,south,east,north = polygon.bounds
    query = f'[out:json][timeout:90];way[highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({south},{west},{north},{east});out geom;'
    request = urllib.request.Request(
        "https://overpass.kumi.systems/api/interpreter?"+urllib.parse.urlencode({"data":query}),
        headers={"User-Agent":"SerembanDashboardDevelopment/1.0"})
    with urllib.request.urlopen(request,timeout=110) as response:
        raw = json.load(response)
    if raw.get("remark"):
        raise RuntimeError(raw["remark"])
    raw_path.parent.mkdir(parents=True,exist_ok=True)
    raw_path.write_text(json.dumps(raw),encoding="utf-8")
raw = json.loads(raw_path.read_text(encoding="utf-8"))
features = []
for way in raw["elements"]:
    coordinates = [(point["lon"],point["lat"]) for point in way.get("geometry",[])]
    if len(coordinates)<2:
        continue
    clipped = LineString(coordinates).intersection(polygon)
    parts = [clipped] if clipped.geom_type=="LineString" else list(getattr(clipped,"geoms",[]))
    for part in parts:
        if part.is_empty or part.geom_type!="LineString":
            continue
        # Keep clipped endpoints exact; don't simplify across the boundary.
        geometry = {"type":"LineString","coordinates":[[round(x,7),round(y,7)] for x,y in part.coords]}
        tags = way.get("tags",{})
        features.append({"type":"Feature","properties":{
            "osm_id":way["id"],"highway":tags.get("highway"),
            "name":tags.get("name",""),"ref":tags.get("ref","")},"geometry":geometry})
output = {"type":"FeatureCollection","features":features,
          "source":"OpenStreetMap contributors", "license":"ODbL-1.0",
          "timestamp":raw.get("osm3s",{}).get("timestamp_osm_base"),
          "boundary_status":boundary["properties"].get("status","unverified")}
(DEST / "nilai-roads.geojson").write_text(json.dumps(output,separators=(",",":")),encoding="utf-8")
print(f"Saved {len(features)} clipped road segments")
