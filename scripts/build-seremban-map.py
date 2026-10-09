"""Build the bundled road extract. Requires Python shapely (pip install shapely).

The border is a DRAFT traced from the supplied screenshot, with approximate
georeferencing. Replace public/maps/seremban-boundary.geojson with a verified
GeoJSON Polygon before using this as an authoritative coverage boundary.
Run with --download to refresh OSM data, or reuse tmp/seremban-roads-raw.json.
"""
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request
from shapely.geometry import LineString, Polygon, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/maps"
DEST.mkdir(parents=True, exist_ok=True)
boundary_path = DEST / "seremban-boundary.geojson"
if not boundary_path.exists():
    # Pixel positions on the user's 755 x 756 reference, approximately located
    # against Seremban and Senawang. These are NOT surveyed boundary points.
    pixels = [(354,34),(111,146),(76,230),(102,365),(101,519),(85,577),
              (94,658),(147,740),(224,671),(298,557),(316,564),(348,603),
              (411,605),(451,636),(537,719),(597,654),(560,579),(515,566),
              (488,586),(456,550),(405,504),(397,477),(414,451),(440,473),
              (471,487),(502,468),(649,524),(692,487),(690,470),(672,450),
              (674,421),(686,391),(682,374),(698,334),(693,307),(704,279),
              (708,257),(691,242),(684,212),(570,230),(602,266),(566,251),
              (552,231),(520,239),(519,257),(509,235),(417,211),
              (393,193),(380,174),(358,174),(354,34)]
    ring = [[round(101.87+x*0.00023,6), round(2.812-y*0.000255,6)] for x,y in pixels]
    boundary = {"type":"Feature", "properties":{
        "name":"Seremban review area", "status":"draft",
        "source":"Approximate trace of user-provided screenshot; not an official boundary",
    }, "geometry":{"type":"Polygon","coordinates":[ring]}}
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
(DEST / "seremban-roads.geojson").write_text(json.dumps(output,separators=(",",":")),encoding="utf-8")
print(f"Saved {len(features)} clipped road segments")
