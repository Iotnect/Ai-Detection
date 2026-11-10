create table public.daily_report_deliveries (
  client_id uuid not null references public.clients(id) on delete cascade,
  report_date date not null,
  recipient text not null,
  owner uuid not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'unknown')),
  attempts integer not null default 1,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  message_id text,
  primary key (client_id, report_date, recipient)
);
alter table public.daily_report_deliveries enable row level security;
revoke all on public.daily_report_deliveries from anon, authenticated;
grant all on public.daily_report_deliveries to service_role;

-- A crashed/ambiguous send is not reclaimed automatically: it may have been accepted by SMTP.
create function public.claim_daily_report(p_client_id uuid, p_report_date date, p_recipient text, p_owner uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare claimed uuid;
begin
  insert into public.daily_report_deliveries (client_id, report_date, recipient, owner, status)
  values (p_client_id, p_report_date, lower(trim(p_recipient)), p_owner, 'sending')
  on conflict (client_id, report_date, recipient) do update
  set owner = excluded.owner, status = 'sending', claimed_at = now(), attempts = public.daily_report_deliveries.attempts + 1
  where public.daily_report_deliveries.status = 'failed'
    and public.daily_report_deliveries.attempts < 3
    and public.daily_report_deliveries.claimed_at < now() - interval '10 minutes'
  returning owner into claimed;
  return claimed = p_owner;
end;
$$;
revoke all on function public.claim_daily_report(uuid, date, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_report(uuid, date, text, uuid) to service_role;
