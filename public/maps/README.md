Nilai road map
==============

Road geometry is from OpenStreetMap contributors, licensed under ODbL 1.0:
https://www.openstreetmap.org/copyright

`nilai-boundary.geojson` is a draft display rectangle covering Nilai, between
101.755–101.925 longitude and 2.765–2.855 latitude. It is not an authoritative
municipal boundary. `nilai-roads.geojson` contains only roads clipped to this
coverage. The previous Seremban coverage and road extract have been removed.

The seven locations in src/lib/camera-locations.ts come from client workbook
MBS Camera location.xlsx rows 61–67, verified against the matching WGS84 point
shapefile MBS_Camera_Location_SHP.zip. Other cameras from the 64-point source
are deliberately excluded. No viewing directions were supplied.

Markers prefer exact inventory camera codes, then match the MBS-KDN identifier
at the start of DSS camera names (discovered records have generated database
codes). Ambiguous name matches are not selected. Markers and individual details
use the same resolver and the Dashboard's 30-second status refresh. Missing
records or failed fetches show unavailable status rather than assuming offline.
Click a map marker to open its name, location, status, and connectivity message
in a card on the map. There is no separate connectivity table or camera list.
The initial view fits the seven Nilai cameras;
All Nilai shows the full Nilai coverage.

The OpenStreetMap credit appears after the map is ready and collapses to an
information button after five seconds. It stays open while hovered or focused.
The button reopens the credit and ODbL licence links, and manual reopening does
not start another countdown. No map interaction is needed to see the initial
attribution.

The dashboard serves both GeoJSON files locally; it needs no runtime mapping
API key or third-party tile requests. Hover roads to see available OSM names.
Click a camera marker to see its coordinates and connectivity details. Clicking
the map background does not add a marker. The coverage outline is labelled Border.

To replace the boundary, provide a verified GeoJSON Feature with Polygon
geometry (coordinates in longitude, latitude order), then regenerate the roads:

    python -m pip install shapely
    python scripts/build-nilai-map.py --download

The script reuses the existing boundary file. Review the generated map before
placing cameras. Camera data should use camera code, latitude, longitude, and
optionally viewing direction in degrees clockwise from north. Match camera
codes with the existing camera inventory to show live status per marker.
