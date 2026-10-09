Seremban road map
================

Road geometry is from OpenStreetMap contributors, licensed under ODbL 1.0:
https://www.openstreetmap.org/copyright

`seremban-boundary.geojson` is an APPROXIMATE review polygon traced from the
user's screenshot with approximate georeferencing. It is not an authoritative
Seremban municipal or district boundary. Roads have accurate OSM coordinates,
but the clip depends on this draft polygon. The coverage has been extended with
a rectangle over Nilai to include the seven client-supplied MBS-KDN cameras.
This extension is a display coverage area, not a municipal boundary.

The seven locations in src/lib/camera-locations.ts come from client workbook
MBS Camera location.xlsx rows 61–67, verified against the matching WGS84 point
shapefile MBS_Camera_Location_SHP.zip. Other cameras from the 64-point source
are deliberately excluded. No viewing directions were supplied.

Markers match live inventory records by camera code, and reuse the Dashboard's
30-second status refresh. Missing records or failed fetches show unavailable
status rather than assuming offline. Click a marker or a C1–C7 button to open
individual connectivity details. The initial view fits the seven Nilai cameras;
Full area shows the combined Seremban and Nilai coverage.

The dashboard serves both GeoJSON files locally; it needs no runtime mapping
API key or third-party tile requests. Hover roads to see available OSM names.
Click the map to inspect latitude, longitude. This inspection dot is not a camera.

To replace the boundary, provide a verified GeoJSON Feature with Polygon
geometry (coordinates in longitude, latitude order), then regenerate the roads:

    python -m pip install shapely
    python scripts/build-seremban-map.py --download

The script reuses the existing boundary file. Review the generated map before
placing cameras. Camera data should use camera code, latitude, longitude, and
optionally viewing direction in degrees clockwise from north. Match camera
codes with the existing camera inventory to show live status per marker.
