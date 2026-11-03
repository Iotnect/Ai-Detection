# Universiti Malaya camera map

Camera: `UM-DEMO-C1`, Q Bistro Universiti Malaya.
Latitude: `3.118629`, longitude: `101.661867`.
The camera point comes from the coordinate selected in the user's screenshot.
It does not describe a measured viewing direction or field of view.

`um-context.geojson` contains OpenStreetMap road, building and water geometry
around the point, retrieved from the OSM API. Its display bounding box is not
an official campus boundary. OSM contributors provide the geometry under
ODbL 1.0: https://www.openstreetmap.org/copyright

To refresh the extract, run `node scripts/build-um-map.mjs`. It requires curl,
downloads a small bounding box from the OSM API, and falls back to Overpass
if needed. The browser loads the resulting GeoJSON locally. It does not query
external tile servers or mapping APIs.

The map uses the same theme palette as the MBS map. Camera details show the
latest local UM demo reading, explicitly marked as illustrative. No live
camera connectivity is inferred from the marker.
