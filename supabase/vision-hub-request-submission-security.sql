-- BunnyHub: prevent guest or signed-in users from spoofing another requester's account.
-- Guest submissions remain anonymous; signed-in submissions may be anonymous or belong to the current user.
begin;

alter table public.vh_requests
  add column if not exists requester_id uuid references auth.users(id) on delete set null;

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

drop policy if exists "Users can view their own requests" on public.vh_requests;
create policy "Users can view their own requests" on public.vh_requests
  for select to authenticated
  using (requester_id = (select auth.uid()));

commit;
