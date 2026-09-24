# AI Detection System

Single-camera production MVP for `MBS-KDN-C1`.

## Runtime architecture

```text
DSS OpenAPI (HTTPS 443)
  -> Railway backend: login, keepalive, refresh, StartVideo
  -> FFmpeg: temporary DSS RTSP (9100) to stable private RTSP
  -> Railway MediaMTX
       -> protected HLS to Vercel dashboard
       -> protected RTSP to Vast.ai inference

Vast.ai -> POST detections -> Railway backend -> Supabase
                                      -> authenticated WebSocket -> dashboard
```

Temporary DSS login tokens, stream tokens, and RTSP URLs exist only in backend
memory. They must never be saved in Supabase, an environment variable, or logs.

## 1. Supabase setup

1. Create a Supabase project.
2. In **Authentication > Providers**, enable Email/Password.
3. Open **SQL Editor**, create a query, paste the entire contents of
   `supabase/migrations/202609240001_initial_schema.sql`, and click **Run**.
4. In **Authentication > Users**, create the first dashboard user and copy its UUID.
5. Run the following in SQL Editor, replacing the user UUID:

```sql
with new_client as (
  insert into public.clients (name)
  values ('MBS')
  returning id
), new_camera as (
  insert into public.cameras (
    client_id, code, name, dss_channel_id, stream_path, location
  )
  select
    id,
    'MBS-KDN-C1',
    'MBS-KDN-C1',
    '1000001$1$0$0',
    'mbs-kdn-c1',
    'Sungai Taman Ros Merah'
  from new_client
  returning client_id
)
insert into public.profiles (id, client_id, full_name, role)
select
  'REPLACE_WITH_AUTH_USER_UUID'::uuid,
  client_id,
  'MBS Administrator',
  'admin'
from new_camera;
```

6. Copy the project URL and publishable key for Vercel. Copy the secret key only
   for Railway. Never put the secret key in Vercel or a `NEXT_PUBLIC_*`
   variable.

## 2. Railway services

Keep both services in one Railway project/environment and name them `backend`
and `mediamtx`.

### Backend

Deploy this repository with **Root Directory** set to `/backend`. Railway will use
`backend/Dockerfile`, which includes FFmpeg. Run exactly one replica initially.

Copy `backend/.env.example` into Railway Variables and replace every blank or
placeholder. Important rules:

- `DSS_CHANNEL_ID` is the stable channel ID, not an RTSP URL.
- `MEDIAMTX_PUBLISH_URL` contains the MediaMTX publisher username and a
  URL-encoded password.
- `MEDIAMTX_PUBLISH_PASSWORD` must contain the original, non-URL-encoded password.
- Keep `DSS_TLS_REJECT_UNAUTHORIZED=true`; use `false` only temporarily when DSS
  has a self-signed/mismatched certificate and no correct hostname is available.
- Keep `STREAM_TRANSCODE_H264=true` for MBS-KDN-C1 because DSS supplies H.265
  and the dashboard targets Chrome-compatible HLS. Confirm Railway has enough CPU.

Expose backend port `4000` through a Railway HTTPS domain. `/health` shows the
relay state without exposing a token or stream URL.

### MediaMTX

Create an empty Railway service from Docker image
`bluenviron/mediamtx:1.19.2` and set:

```text
MTX_AUTHMETHOD=http
MTX_AUTHHTTPADDRESS=http://backend.railway.internal:4000/internal/mediamtx/auth
MTX_RTSPTRANSPORTS=tcp
MTX_HLSVARIANT=fmp4
MTX_HLSALWAYSREMUX=yes
MTX_HLSSEGMENTDURATION=1s
MTX_HLSALLOWORIGINS=https://YOUR-VERCEL-DOMAIN
MTX_HLSTRUSTEDPROXIES=0.0.0.0/0,::/0
MTX_API=no
MTX_RTMP=no
MTX_SRT=no
MTX_WEBRTC=no
MTX_MOQ=no
```

Generate a Railway HTTP domain targeting port `8888` for dashboard HLS. Add a TCP
Proxy targeting port `8554` for Vast.ai RTSP. Internal backend-to-MediaMTX traffic
uses `mediamtx.railway.internal:8554`; do not route it through the public proxy.

If MBS restricts DSS access by source IP, enable Railway Static Outbound IP and
ask MBS to allow that IP to reach DSS TCP `443` and `9100`.

## 3. Vercel

Import the repository and set:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-DOMAIN
NEXT_PUBLIC_HLS_URL=https://YOUR-MEDIAMTX-DOMAIN/mbs-kdn-c1/index.m3u8
```

Redeploy after changing any `NEXT_PUBLIC_*` variable because Next.js embeds these
at build time. Add the Vercel URL to `FRONTEND_ORIGINS` on Railway.

## 4. Vast.ai inference

Give the inference service the protected MediaMTX URL, not the temporary DSS URL:

```text
rtsp://VAST_READER:URL_ENCODED_PASSWORD@RAILWAY_TCP_PROXY_HOST:PORT/mbs-kdn-c1
```

It sends each detection to:

```http
POST https://YOUR-BACKEND-DOMAIN/api/v1/detections
Authorization: Bearer AI_SERVICE_SECRET
Content-Type: application/json
```

See `backend/README.md` for the payload. The dashboard receives tenant-filtered
updates through an authenticated WebSocket using the current Supabase session.

## Local checks

```powershell
npm.cmd run build
Set-Location backend
npm.cmd run build
```

Run `docker compose up -d mediamtx` after Docker Desktop is started. Local demo
login remains available only when Supabase frontend variables are absent.
