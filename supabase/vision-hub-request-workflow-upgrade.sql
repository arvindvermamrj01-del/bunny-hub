-- BunnyHub request workflow upgrade (additive; preserves existing requests).
alter table public.vh_requests
  add column if not exists requester_id uuid references auth.users(id) on delete set null,
  add column if not exists admin_note text,
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.vh_requests drop constraint if exists vh_requests_priority_check;
alter table public.vh_requests add constraint vh_requests_priority_check
  check (priority in ('low','normal','high','urgent'));

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.vh_requests'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.vh_requests drop constraint %I',c.conname);
  end loop;
end $$;

alter table public.vh_requests
  add constraint vh_requests_status_check
  check (status in ('pending','approved','declined','completed'));

create index if not exists vh_requests_requester_created_idx
  on public.vh_requests(requester_id, created_at desc);
create index if not exists vh_requests_status_created_idx
  on public.vh_requests(status, created_at desc);

alter table public.vh_requests enable row level security;

drop policy if exists "Users can view their own requests" on public.vh_requests;
create policy "Users can view their own requests"
  on public.vh_requests for select to authenticated
  using (requester_id = auth.uid());

drop policy if exists "Visitors can submit pending requests" on public.vh_requests;
drop policy if exists "vh_requests_public_insert" on public.vh_requests;
drop policy if exists "Users can submit requests for themselves" on public.vh_requests;
create policy "vh_requests_public_insert" on public.vh_requests
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and (requester_id is null or requester_id = (select auth.uid()))
  );

-- Existing admin policies are intentionally left in place.
