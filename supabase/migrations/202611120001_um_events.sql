create table public.um_events (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  timestamp timestamptz not null,
  received_at timestamptz not null default now(),
  level_code integer not null check (level_code >= 0),
  status text not null check (status in ('NORMAL', 'RISING', 'WARNING', 'DANGER')),
  waterline_y_px double precision not null check (waterline_y_px >= 0 and waterline_y_px < 'Infinity'::double precision),
  trigger text not null,
  raw_rtsp text,
  ai_rtsp text,
  unique (device_id, timestamp, trigger)
);
create index um_events_device_time_idx on public.um_events (device_id, timestamp desc, received_at desc);
alter table public.um_events enable row level security;
revoke all on public.um_events from anon, authenticated;
grant select, insert, update on public.um_events to service_role;
