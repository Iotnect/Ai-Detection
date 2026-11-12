# UM inference integration

## Deploy

1. Apply `supabase/migrations/202611120001_um_events.sql` in the Supabase SQL Editor.
2. Add backend Railway variables:

```dotenv
UM_SERVICE_SECRET=YOUR_NEW_RANDOM_64_HEX_CHARACTER_KEY
UM_DEVICE_ID=um-flood-edge-01
```

Generate the key locally with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a dedicated UM key and share it privately with the inference developer.
It is never a NEXT_PUBLIC variable. The existing Supabase service key handles storage.
Keep `https://neovision.iotnect.com` in FRONTEND_ORIGINS. Deploy backend and Vercel.
The frontend uses its existing NEXT_PUBLIC_API_URL to poll UM data every 10 seconds.

## Publish

```text
POST https://backend-production-1b114.up.railway.app/api/v1/um/events
Authorization: Bearer YOUR_UM_SERVICE_SECRET
Content-Type: application/json
```

```json
{
  "device_id": "um-flood-edge-01",
  "timestamp": "2026-11-12T05:17:00.123456+00:00",
  "level_code": 1,
  "status": "NORMAL",
  "waterline_y_px": 685,
  "trigger": "STATE_CHANGE",
  "streams": {
    "raw_rtsp": "rtsp://ORANGE_PI_IP:8554/channel_0",
    "ai_rtsp": "rtsp://ORANGE_PI_IP:8554/channel_1"
  }
}
```

Use the actual current timestamp with an explicit timezone for a live reading.
UTC or +08:00 are supported. Timestamps more than five minutes in the future are
rejected. Historical events remain visible as recorded history rather than live.
The streams object and its fields are optional. RTSP/RTSPS addresses are stored
privately for later video configuration; ingesting an address never initiates a
network request. They are excluded from all dashboard responses and logs.

Accepted status strings are NORMAL, RISING, WARNING and DANGER. WARNING is displayed
in amber. level_code is stored as provided and does not override status. Confirm
the device's final code/status mapping before enabling publishing. Trigger is a
non-empty string, allowing STATE_CHANGE and HEARTBEAT without firmware remapping.

Send state changes immediately and a fresh HEARTBEAT reading every 60 seconds.
On a network error or HTTP 503, retry the same event with its original timestamp
and trigger. A new event returns HTTP 201, `accepted:true, persisted:true`.
Repeating the same device/timestamp/trigger returns HTTP 200 with `duplicate:true`.
Retries cannot overwrite the original measurement or refresh its received time.
HTTP 400 indicates invalid input, 401 a missing/wrong key, 403 a different device,
and 503 disabled configuration or unavailable storage. Do not retry 4xx unchanged.

## Dashboard data

`GET /api/v1/um/events?limit=1000` returns the latest 1,000 UM events, newest first,
with a normalized camera ID UM-C1. Event time determines ordering, so delayed
packets cannot replace a newer reading. Every saved event remains in Supabase.
Event Log shows the newest one. Water Level charts the available last-24-hour
readings from a separately paginated full 24-hour `trend` array, visually sampled
to 180 bars. The trend is not truncated by the history limit. Display Log filters the returned history.
Map details use the same latest reading.

UM preserves its existing public presentation access. The read endpoint exposes
sanitized water-level data without a login, using an exact NeoVision Origin/CORS
check for browser access. Origin checks are a presentation restriction, not
authentication. It returns no API key or RTSP credentials. The database itself
has RLS enabled and no anon/authenticated read/write grants.

Only UM pages on neovision.iotnect.com mount the data provider. Other domains do
not fetch UM data. Failed polling retains the last reading with Reconnecting;
readings older than two minutes show Last recorded reading. Empty storage shows
a waiting state. Former sample readings are no longer displayed as real data.
Local original/AI replay videos remain configured until RTSP reachability and
the Orange Pi network are agreed. Data API integration does not require Tailscale.

This data is stored in um_events, outside MBS events and daily MBS reports.
