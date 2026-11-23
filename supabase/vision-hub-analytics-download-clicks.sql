-- Track download-link clicks separately from play clicks.
begin;
alter table public.vh_analytics_events
  drop constraint if exists vh_analytics_events_event_type_check;
alter table public.vh_analytics_events
  add constraint vh_analytics_events_event_type_check
  check (event_type in ('page_view','content_view','play_click','download_click','request_submit'));

drop policy if exists "vh_analytics_public_insert" on public.vh_analytics_events;
create policy "vh_analytics_public_insert" on public.vh_analytics_events
  for insert to anon, authenticated
  with check (event_type in ('page_view','content_view','play_click','download_click','request_submit'));
commit;
