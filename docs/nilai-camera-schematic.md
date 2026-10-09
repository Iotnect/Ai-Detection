# Nilai camera schematic

The Dashboard schematic is an original SVG layout. Camera points are projected
from the seven client-supplied WGS84 coordinates in `src/lib/camera-locations.ts`.
North is up; label positions are manually arranged for readability. Dashed leader
lines connect labels to points and do not represent streets or camera connections.
No road, boundary, satellite, or third-party basemap data is used.

Locations were supplied in `MBS Camera location.xlsx`, rows 61?67, and checked
against `MBS_Camera_Location_SHP.zip`. Other source cameras are not included.
Viewing directions were not supplied and are not inferred.

Each point and C1?C7 button opens the camera's connectivity details. Status is
matched by camera code against the existing inventory and refreshed every 30
seconds. Unknown or failed requests are shown as unavailable, not offline.
Keyboard users can Tab to a point and press Enter or Space to select it.

The former OpenStreetMap data files, downloader, and Leaflet dependencies have
been removed from this version. No OpenStreetMap attribution is needed for this
schematic because it contains none of that data. The repository history retains
the original road-data provenance and licence information for earlier versions.
