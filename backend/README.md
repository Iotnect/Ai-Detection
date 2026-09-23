# Backend

Fastify service for DSS session automation, stream relay supervision, detection
ingestion, Supabase persistence, and real-time WebSocket delivery.

## Commands

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

`GET /health` returns the API and stream relay state. DSS automation stays disabled
unless the complete DSS configuration and `MEDIAMTX_PUBLISH_URL` are present.

## Detection ingestion

The inference service authenticates with `AI_SERVICE_SECRET`:

```http
POST /api/v1/detections
Authorization: Bearer <AI_SERVICE_SECRET>
Content-Type: application/json
```

```json
{
  "camera_id": "MBS-KDN-C1",
  "raw_y": 672,
  "smoothed_y": 670,
  "status": "NORMAL",
  "event_type": "WATER_LEVEL",
  "confidence": 0.94,
  "timestamp": "2026-09-23T15:41:00.000+08:00",
  "message": "Water level stable",
  "image_url": null
}
```

`event_type`, `confidence`, and `image_url` are optional. A valid request returns
`202 Accepted`; its `persisted` field says whether that reading was sampled into
Supabase.

The service broadcasts every accepted reading, but persists at most one sample per
camera per `DETECTION_PERSIST_INTERVAL_MS` (default 60 seconds), plus immediate
status changes. This avoids writing 86,400 rows per camera every day.

## Dashboard endpoints

- `GET /api/v1/detections/latest`
- `GET /api/v1/ws/detections` (WebSocket upgrade)

In production, REST requests use `Authorization: Bearer <Supabase access token>`.
The browser sends that access token as the WebSocket subprotocol, avoiding tokens
in URLs and request logs. Results are filtered by the user's `client_id`.

Without Supabase configuration, local REST/WebSocket testing can use
`DASHBOARD_WS_SECRET` as the Bearer token or WebSocket subprotocol.

## DSS lifecycle

At startup the service authenticates with DSS and holds the session only in memory.
It runs keepalive and token refresh on serialized timers. For each relay start it
calls `StartVideo`, appends the newly returned stream token to the external RTSP
URL, and immediately launches FFmpeg. If FFmpeg exits, the service requests a new
stream token before retrying; an old stream token is never reused.

Do not log or persist DSS passwords, login tokens, stream tokens, credentials, or
temporary RTSP URLs.

## MediaMTX authentication callback

MediaMTX calls `POST /internal/mediamtx/auth` over Railway private networking.
The endpoint permits only:

- the configured relay publisher to publish `mbs-kdn-c1`;
- the configured Vast.ai reader to read it over RTSP;
- a valid Supabase user assigned to that camera's client to read HLS.
