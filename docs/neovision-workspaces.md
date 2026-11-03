# NeoVision project selection

`neovision.iotnect.com/` is a public project selector with the existing
NeoVision logo and two cards:

- MBS opens `/camera-status`, using the existing authentication and backend.
- UM opens `/um`, a public demo with no backend or Supabase data queries.

The MBS AI Detection page is at `/ai-detection` on NeoVision so `/` can serve
the selector. Other hosts, including `mbs.iotnect.com`, keep their existing
AI Detection page at `/`, with the existing protected dashboard/login flow.

UM is hostname-gated to exactly `neovision.iotnect.com`; this is a product
routing restriction, not a security boundary for confidential demo assets.
Its sidebar reuses the MBS layout with local pages at `/um`,
`/um/ai-detection`, `/um/water-level`, `/um/display-log`, and `/um/reporting`.
Event Log, Water Level and Display Log share local illustrative readings based
on the MBS format, labelled as sample data. These are not live UM measurements
or a copy of MBS historical records. The dataset is in `src/lib/um-demo-data.ts`.
Display Log supports local text search and status filtering. No UM map is
configured yet.

UM original and AI videos are configured in `src/lib/um-demo.ts`.
See `public/um/README.md` for the file paths. Videos are not supplied yet.
PDF reporting remains disabled in the UM demo.

Both workspaces provide a Back to projects link on NeoVision. Landing and
UM use the shared light/dark theme. The UM workspace never mounts MBS
camera, detection or notification hooks. Auth initialization is lazy and
skipped on the public selector and UM routes.
