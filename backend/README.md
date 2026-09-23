# AI Detection Backend

## Local development

```powershell
npm.cmd run dev
```

The API listens on `http://localhost:4000` by default.

## Health check

```http
GET /health
```

## Submit a detection

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
  "timestamp": "2026-09-23T15:41:00.000+08:00",
  "message": "Water level stable"
}
```

Successful ingestion returns HTTP `202 Accepted`:

```json
{
  "accepted": true,
  "camera_id": "MBS-KDN-C1",
  "received_at": "2026-09-23T07:59:51.632Z"
}
```

## Read the latest detections

```http
GET /api/v1/detections/latest
Authorization: Bearer <AI_SERVICE_SECRET>
```

The current implementation keeps only the latest reading per camera in memory. Data is
cleared whenever the backend restarts. Persistent event storage will be added with the
database integration.

## Live detection WebSocket

For local development, connect to:

```text
ws://localhost:4000/api/v1/ws/detections?token=<DASHBOARD_WS_SECRET>
```

The server immediately sends a snapshot, then broadcasts every accepted detection:

```json
{
  "type": "detection",
  "data": {
    "camera_id": "MBS-KDN-C1",
    "raw_y": 672,
    "smoothed_y": 670,
    "status": "NORMAL",
    "timestamp": "2026-09-23T15:41:00.000+08:00",
    "message": "Water level stable",
    "received_at": "2026-09-23T07:59:51.632Z"
  }
}
```

The query-string token is for local development only. Production must replace it with
the dashboard's authenticated server session before the WebSocket is exposed publicly.
