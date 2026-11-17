create or replace function public.record_camera_connectivity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status_checked_at is null or new.status not in ('online', 'offline') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status_checked_at is not null and new.status_checked_at <= old.status_checked_at then
      return null;
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

