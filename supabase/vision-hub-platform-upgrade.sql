-- BunnyHub platform upgrade: private upload storage, role-based staff, R2 and subtitle metadata.
-- Additive migration. Existing catalog, users, requests and media rows are preserved.
begin;

-- Support separate least-privilege staff roles while keeping "admin" as the owner/super-admin.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user','admin','sub_admin','content_editor','moderator'));

create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.vh_can_manage_content()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','sub_admin','content_editor')
  );
$$;

create or replace function private.vh_can_manage_content_item(p_content_id bigint)
returns boolean language sql stable security definer
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

create or replace function private.vh_can_manage_requests()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','sub_admin','moderator')
  );
$$;

revoke all on function private.vh_can_manage_content() from public, anon, authenticated;
revoke all on function private.vh_can_manage_content_item(bigint) from public, anon, authenticated;
revoke all on function private.vh_can_manage_requests() from public, anon, authenticated;
grant execute on function private.vh_can_manage_content() to authenticated, service_role;
grant execute on function private.vh_can_manage_content_item(bigint) to authenticated, service_role;
grant execute on function private.vh_can_manage_requests() to authenticated, service_role;

create or replace function public.vh_can_manage_content()
returns boolean language sql stable security invoker
set search_path = ''
as $ select private.vh_can_manage_content(); $;
create or replace function public.vh_can_manage_content_item(p_content_id bigint)
returns boolean language sql stable security invoker
set search_path = ''
as $ select private.vh_can_manage_content_item(p_content_id); $;
create or replace function public.vh_can_manage_requests()
returns boolean language sql stable security invoker
set search_path = ''
as $ select private.vh_can_manage_requests(); $;

revoke all on function public.vh_can_manage_content() from public, anon, authenticated;
revoke all on function public.vh_can_manage_content_item(bigint) from public, anon, authenticated;
revoke all on function public.vh_can_manage_requests() from public, anon, authenticated;
grant execute on function public.vh_can_manage_content() to authenticated, service_role;
grant execute on function public.vh_can_manage_content_item(bigint) to authenticated, service_role;
grant execute on function public.vh_can_manage_requests() to authenticated, service_role;


-- The current upload code uses this private bucket. It was missing from the original master setup.
insert into storage.buckets (id, name, public)
values ('vh-private-media','vh-private-media',false)
on conflict (id) do update set public = false;

-- Editors may access only objects stored under their own UUID prefix.
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
  with check (
    bucket_id = 'vh-private-media'
    and public.vh_can_manage_private_media_object(name)
  );
create policy "vh_private_media_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vh-private-media'
    and public.vh_can_manage_private_media_object(name)
  )
  with check (
    bucket_id = 'vh-private-media'
    and public.vh_can_manage_private_media_object(name)
  );
create policy "vh_private_media_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vh-private-media'
    and public.vh_can_manage_private_media_object(name)
  );
create policy "vh_private_media_admin_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vh-private-media'
    and public.vh_can_manage_private_media_object(name)
  );


-- Content metadata used by the advanced player.
alter table public.vh_content
  add column if not exists telegram_url text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists subtitle_tracks jsonb not null default '[]'::jsonb,
  add column if not exists director text,
  add column if not exists screenshots text[] not null default '{}'::text[],
  add column if not exists storage_provider text not null default 'supabase';

alter table public.vh_content drop constraint if exists vh_content_storage_provider_check;
revoke select on public.vh_content from anon;
grant select (
  id,title,content_type,video_url,poster_url,genre,language,release_year,rating,
  description,"cast",duration,trailer_url,industry,published,created_at,storage_provider,
  telegram_url,is_featured,subtitle_tracks,director,screenshots
) on public.vh_content to anon;
grant select on public.vh_content to authenticated;

alter table public.vh_content add constraint vh_content_storage_provider_check
  check (storage_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive',
    'mediafire','pcloud','box','icedrive','koofr','internxt','telegram','direct'
  ));

-- Create media metadata table if this project was started from the older setup.
create table if not exists public.vh_media_assets (
  id bigint generated by default as identity primary key,
  content_id bigint not null references public.vh_content(id) on delete cascade,
  asset_type text not null default 'video',
  asset_url text not null,
  storage_path text,
  storage_provider text not null default 'supabase',
  resolution text,
  language text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.vh_media_assets
  add column if not exists asset_type text not null default 'video',
  add column if not exists asset_url text,
  add column if not exists storage_path text,
  add column if not exists storage_provider text not null default 'supabase',
  add column if not exists resolution text,
  add column if not exists language text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.vh_media_assets drop constraint if exists vh_media_assets_asset_type_check;
alter table public.vh_media_assets add constraint vh_media_assets_asset_type_check
  check (asset_type in ('video','audio','subtitle'));
alter table public.vh_media_assets drop constraint if exists vh_media_assets_storage_provider_check;
alter table public.vh_media_assets add constraint vh_media_assets_storage_provider_check
  check (storage_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive',
    'mediafire','pcloud','box','icedrive','koofr','internxt','telegram','direct'
  ));

create index if not exists vh_media_assets_content_id_idx on public.vh_media_assets(content_id);
alter table public.vh_media_assets enable row level security;
drop policy if exists "vh_media_assets_public_read" on public.vh_media_assets;
drop policy if exists "vh_media_assets_staff_all" on public.vh_media_assets;
drop policy if exists "Admins can manage media assets" on public.vh_media_assets;
create policy "vh_media_assets_public_read" on public.vh_media_assets
  for select to anon, authenticated
  using (exists (
    select 1 from public.vh_content c
    where c.id = vh_media_assets.content_id and c.published = true
  ));
create policy "vh_media_assets_staff_all" on public.vh_media_assets
  for all to authenticated
  using (public.vh_can_manage_content_item(content_id))
  with check (public.vh_can_manage_content_item(content_id));
grant select on public.vh_media_assets to anon, authenticated;
grant insert, update, delete on public.vh_media_assets to authenticated;
grant usage, select on sequence public.vh_media_assets_id_seq to authenticated;

-- The Category Manager supports an optional public description.
alter table public.vh_categories
  add column if not exists description text;

-- Extend provider selectors without storing credentials in SQL.
alter table public.vh_storage_settings drop constraint if exists vh_storage_settings_default_provider_check;
alter table public.vh_storage_settings add constraint vh_storage_settings_default_provider_check
  check (default_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive',
    'mediafire','pcloud','box','icedrive','koofr','internxt','telegram'
  ));

drop policy if exists "vh_content_admin_all" on public.vh_content;
drop policy if exists "Admins can manage content" on public.vh_content;
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

drop policy if exists "vh_requests_admin_select" on public.vh_requests;
drop policy if exists "vh_requests_admin_update" on public.vh_requests;
drop policy if exists "vh_requests_admin_delete" on public.vh_requests;
drop policy if exists "Admins can view requests" on public.vh_requests;
drop policy if exists "Admins can moderate requests" on public.vh_requests;
drop policy if exists "Admins can delete requests" on public.vh_requests;
drop policy if exists "vh_requests_staff_select" on public.vh_requests;
drop policy if exists "vh_requests_staff_update" on public.vh_requests;
drop policy if exists "vh_requests_staff_delete" on public.vh_requests;
create policy "vh_requests_staff_select" on public.vh_requests
  for select to authenticated using (public.vh_can_manage_requests());
create policy "vh_requests_staff_update" on public.vh_requests
  for update to authenticated using (public.vh_can_manage_requests())
  with check (public.vh_can_manage_requests());
create policy "vh_requests_staff_delete" on public.vh_requests
  for delete to authenticated using (public.vh_can_manage_requests());

commit;
