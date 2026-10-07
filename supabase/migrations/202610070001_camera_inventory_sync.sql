alter table public.cameras
  add column if not exists dss_device_code text,
  add column if not exists live_stream_enabled boolean not null default false;

create unique index if not exists cameras_client_dss_channel_id_idx
  on public.cameras (client_id, dss_channel_id);

update public.cameras
set live_stream_enabled = (code = 'MBS-KDN-C1');

comment on column public.cameras.dss_device_code is
  'Stable DSS device identifier used for batch status queries.';

comment on column public.cameras.live_stream_enabled is
  'True only for cameras with an active StartVideo/MediaMTX relay.';
