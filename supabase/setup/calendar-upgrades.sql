-- Review and run only on a test database first. Additive, no existing events removed.
begin;
alter table public.events add column if not exists end_time time without time zone;
alter table public.events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.events add constraint events_end_after_start
  check (end_time is null or (time is not null and end_time > time));

-- Always derive the author from the authenticated session, never from the owner label.
create or replace function public.calendar_set_event_author() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then new.created_by := auth.uid();
  else new.created_by := old.created_by; end if;
  return new;
end;
$$;
create trigger calendar_event_author before insert or update on public.events
  for each row execute function public.calendar_set_event_author();

create table public.calendar_push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint) between 1 and 2048),
  p256dh text not null check (length(p256dh) between 1 and 200),
  auth text not null check (length(auth) between 1 and 100),
  primary key(user_id, endpoint)
);
alter table public.calendar_push_subscriptions enable row level security;
revoke all on public.calendar_push_subscriptions from anon;
grant select,insert,update,delete on public.calendar_push_subscriptions to authenticated;
grant select,delete on public.calendar_push_subscriptions to service_role;
create policy "Own subscriptions only" on public.calendar_push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.calendar_members m where m.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.calendar_members m where m.user_id = (select auth.uid())));

create table public.calendar_push_deliveries (
  event_id uuid primary key references public.events(id) on delete cascade
);
alter table public.calendar_push_deliveries enable row level security;
revoke all on public.calendar_push_deliveries from anon, authenticated;
grant select,insert on public.calendar_push_deliveries to service_role;
commit;
