alter table public.cameras
  add column status_checked_at timestamptz,
  add column status_since_at timestamptz,
  add column status_check_interval_ms integer not null default 60000
    check (status_check_interval_ms > 0);

create table public.camera_connectivity_observations (
  camera_id uuid not null references public.cameras(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  checked_at timestamptz not null,
  status text not null check (status in ('online', 'offline')),
  status_since_at timestamptz not null,
  check_interval_ms integer not null check (check_interval_ms > 0),
  primary key (camera_id, checked_at)
);
create index camera_connectivity_client_time
  on public.camera_connectivity_observations(client_id, checked_at, camera_id);
alter table public.camera_connectivity_observations enable row level security;
revoke all on public.camera_connectivity_observations from anon, authenticated;
grant all on public.camera_connectivity_observations to service_role;

create function public.record_camera_connectivity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status_checked_at is null or new.status not in ('online', 'offline') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status_checked_at is not null and new.status_checked_at <= old.status_checked_at then
      return new;
    end if;
    if old.status = new.status and old.status_since_at is not null
      and new.status_checked_at - old.status_checked_at <=
        make_interval(secs => 3.0 * greatest(old.status_check_interval_ms, new.status_check_interval_ms) / 1000)
    then
      new.status_since_at := old.status_since_at;
    else
      new.status_since_at := new.status_checked_at;
    end if;
  else
    new.status_since_at := new.status_checked_at;
  end if;
  return new;
end;
$$;
create trigger cameras_record_connectivity
  before insert or update of status_checked_at on public.cameras
  for each row execute function public.record_camera_connectivity();
revoke all on function public.record_camera_connectivity() from public;

create function public.save_camera_connectivity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status_checked_at is null or new.status not in ('online', 'offline') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status_checked_at is not null and new.status_checked_at <= old.status_checked_at then
      return new;
    end if;
  end if;
  insert into public.camera_connectivity_observations
    (camera_id, client_id, checked_at, status, status_since_at, check_interval_ms)
  values (new.id, new.client_id, new.status_checked_at, new.status, new.status_since_at, new.status_check_interval_ms);
  return new;
end;
$$;
create trigger cameras_save_connectivity
  after insert or update of status_checked_at on public.cameras
  for each row execute function public.save_camera_connectivity();
revoke all on function public.save_camera_connectivity() from public;

