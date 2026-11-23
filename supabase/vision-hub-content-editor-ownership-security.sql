-- BunnyHub: enforce content-editor ownership at the database and private-storage layers.
-- Admins and sub-admins retain full management access. Editors can manage only their own non-Short content.
begin;

create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.vh_can_manage_content_item(p_content_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.vh_content c on c.id = p_content_id
    where p.id = (select auth.uid())
      and (
        p.role in ('admin','sub_admin')
        or (
          p.role = 'content_editor'
          and c.content_type <> 'Short'
          and c.created_by = (select auth.uid())
        )
      )
  );
$$;
revoke all on function private.vh_can_manage_content_item(bigint) from public, anon, authenticated;
grant execute on function private.vh_can_manage_content_item(bigint) to authenticated, service_role;

create or replace function public.vh_can_manage_content_item(p_content_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ SELECT private.vh_can_manage_content_item(p_content_id); $$;
revoke all on function public.vh_can_manage_content_item(bigint) from public, anon, authenticated;
grant execute on function public.vh_can_manage_content_item(bigint) to authenticated, service_role;


drop policy if exists "vh_content_staff_all" on public.vh_content;
create policy "vh_content_staff_all" on public.vh_content
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and (
          p.role in ('admin','sub_admin')
          or (
            p.role = 'content_editor'
            and vh_content.content_type <> 'Short'
            and vh_content.created_by = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and (
          p.role in ('admin','sub_admin')
          or (
            p.role = 'content_editor'
            and vh_content.content_type <> 'Short'
            and vh_content.created_by = (select auth.uid())
          )
        )
    )
  );

create or replace function public.vh_can_manage_private_media_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and (
        p.role in ('admin','sub_admin')
        or (
          p.role = 'content_editor'
          and p_object_name like ((select auth.uid())::text || '/%')
        )
      )
  );
$$;
revoke all on function public.vh_can_manage_private_media_object(text) from public;
grant execute on function public.vh_can_manage_private_media_object(text) to authenticated;

drop policy if exists "vh_private_media_staff_insert" on storage.objects;
drop policy if exists "vh_private_media_staff_update" on storage.objects;
drop policy if exists "vh_private_media_staff_delete" on storage.objects;
drop policy if exists "vh_private_media_admin_read" on storage.objects;

create policy "vh_private_media_staff_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vh-private-media' and public.vh_can_manage_private_media_object(name));
create policy "vh_private_media_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vh-private-media' and public.vh_can_manage_private_media_object(name))
  with check (bucket_id = 'vh-private-media' and public.vh_can_manage_private_media_object(name));
create policy "vh_private_media_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vh-private-media' and public.vh_can_manage_private_media_object(name));
create policy "vh_private_media_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'vh-private-media' and public.vh_can_manage_private_media_object(name));

commit;
