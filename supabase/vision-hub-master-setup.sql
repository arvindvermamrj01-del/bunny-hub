-- BunnyHub MASTER DATABASE SETUP
-- Run this ONE file in Supabase Dashboard > SQL Editor > New query.
-- Safe to re-run. Uses only the publishable browser key; NEVER put service-role keys in the website.
-- Admin account is promoted by its existing Auth UUID. Confirm this UUID is yours before running.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  fullname text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists fullname text;
-- Preserve display names from older installations that used the full_name column.
do $vh_profile_name_compat$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    execute $copy_profile_names$
      update public.profiles
      set fullname = coalesce(nullif(btrim(fullname), ''), nullif(btrim(full_name), ''))
      where fullname is null or btrim(fullname) = ''
    $copy_profile_names$$;
  end if;
end
$vh_profile_name_compat$$;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles enable row level security;

create schema if not exists private authorization postgres;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.vh_is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.vh_is_admin() from public, anon, authenticated;
grant execute on function private.vh_is_admin() to anon, authenticated, service_role;

create or replace function public.vh_is_admin()
returns boolean language sql stable security invoker
set search_path = ''
as $$ select private.vh_is_admin(); $$;
revoke all on function public.vh_is_admin() from public, anon, authenticated;
grant execute on function public.vh_is_admin() to anon, authenticated, service_role;


create or replace function public.vh_guard_profile_role()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.vh_is_admin() then
    raise exception 'Only an administrator may change profile roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.vh_guard_profile_role() from public, anon, authenticated;
drop trigger if exists vh_guard_profile_role on public.profiles;
create trigger vh_guard_profile_role
before update of role on public.profiles
for each row execute function public.vh_guard_profile_role();

insert into public.profiles (id, fullname, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'fullname'),
       'user'
from auth.users u
on conflict (id) do nothing;

create or replace function public.vh_handle_new_user()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, fullname, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'fullname'), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists vh_on_auth_user_created on auth.users;
create trigger vh_on_auth_user_created
after insert on auth.users
for each row execute function public.vh_handle_new_user();

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own user profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users create own basic profile" on public.profiles;
drop policy if exists "Users can update own name" on public.profiles;
drop policy if exists "Admins update profiles" on public.profiles;
drop policy if exists "Users read own profile or admins read all" on public.profiles;
drop policy if exists "vh_profiles_select" on public.profiles;
drop policy if exists "vh_profiles_insert" on public.profiles;
drop policy if exists "vh_profiles_update" on public.profiles;
create policy "vh_profiles_select" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.vh_is_admin());
create policy "vh_profiles_insert" on public.profiles
for insert to authenticated with check (id = (select auth.uid()) and role = 'user');
create policy "vh_profiles_update" on public.profiles
for update to authenticated using (id = (select auth.uid()) or public.vh_is_admin())
with check (id = (select auth.uid()) or public.vh_is_admin());
grant select, insert, update on public.profiles to authenticated;

-- Content catalog
create table if not exists public.vh_content (
  id bigint generated by default as identity primary key,
  title text not null,
  content_type text not null check (content_type in ('Movie','Web Series','Documentary','Short')),
  video_url text not null,
  poster_url text,
  genre text,
  language text,
  release_year integer,
  rating numeric(3,1),
  description text,
  "cast" text,
  duration text,
  trailer_url text,
  industry text,
  published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram'))
);
alter table public.vh_content add column if not exists storage_provider text not null default 'supabase';
alter table public.vh_content enable row level security;
drop policy if exists "Public can read published content" on public.vh_content;
drop policy if exists "Admins can manage content" on public.vh_content;
drop policy if exists "vh_content_public_read" on public.vh_content;
drop policy if exists "vh_content_admin_all" on public.vh_content;
create policy "vh_content_public_read" on public.vh_content
for select to anon, authenticated using (published = true or public.vh_is_admin());
create policy "vh_content_admin_all" on public.vh_content
for all to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
revoke select on public.vh_content from anon;
grant select (
  id,title,content_type,video_url,poster_url,genre,language,release_year,rating,
  description,"cast",duration,trailer_url,industry,published,created_at,storage_provider
) on public.vh_content to anon;
grant select on public.vh_content to authenticated;
grant insert, update, delete on public.vh_content to authenticated;
grant usage, select on sequence public.vh_content_id_seq to authenticated;

-- Public submissions; only admins can inspect/moderate.
create table if not exists public.vh_requests (
  id bigint generated by default as identity primary key,
  request_title text not null check (char_length(btrim(request_title)) between 1 and 160),
  content_type text not null default 'Movie' check (content_type in ('Movie','Web Series','Documentary')),
  release_year integer check (release_year is null or release_year between 1900 and 2100),
  preferred_language text check (preferred_language is null or char_length(preferred_language) <= 80),
  notes text check (notes is null or char_length(notes) <= 1200),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  requester_id uuid references auth.users(id) on delete set null
);
alter table public.vh_requests
  add column if not exists requester_id uuid references auth.users(id) on delete set null;
alter table public.vh_requests enable row level security;
revoke all on public.vh_requests from anon, authenticated;
grant insert on public.vh_requests to anon, authenticated;
grant select, update, delete on public.vh_requests to authenticated;
grant usage, select on sequence public.vh_requests_id_seq to anon, authenticated;
drop policy if exists "Visitors can submit pending requests" on public.vh_requests;
drop policy if exists "vh_requests_public_insert" on public.vh_requests;
drop policy if exists "Users can submit requests for themselves" on public.vh_requests;
drop policy if exists "Admins can view requests" on public.vh_requests;
drop policy if exists "Admins can moderate requests" on public.vh_requests;
drop policy if exists "Admins can delete requests" on public.vh_requests;
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
create policy "vh_requests_admin_select" on public.vh_requests
for select to authenticated using (public.vh_is_admin());
create policy "vh_requests_admin_update" on public.vh_requests
for update to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
create policy "vh_requests_admin_delete" on public.vh_requests
for delete to authenticated using (public.vh_is_admin());

-- Default storage selection only. Provider selection does NOT create OAuth/API integration.
create table if not exists public.vh_storage_settings (
  id smallint primary key default 1 check (id = 1),
  default_provider text not null default 'backblaze_b2'
    check (default_provider in ('supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.vh_storage_settings enable row level security;
drop policy if exists "Admins can read storage settings" on public.vh_storage_settings;
drop policy if exists "Admins can insert storage settings" on public.vh_storage_settings;
drop policy if exists "Admins can update storage settings" on public.vh_storage_settings;
create policy "vh_storage_admin_select" on public.vh_storage_settings for select to authenticated using (public.vh_is_admin());
create policy "vh_storage_admin_insert" on public.vh_storage_settings for insert to authenticated with check (public.vh_is_admin());
create policy "vh_storage_admin_update" on public.vh_storage_settings for update to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
grant select, insert, update on public.vh_storage_settings to authenticated;
insert into public.vh_storage_settings (id, default_provider) values (1,'backblaze_b2')
on conflict (id) do nothing;

-- Admin-managed categories, songs and public site settings (no secrets).
create table if not exists public.vh_categories (
  id bigint generated by default as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.vh_categories enable row level security;
drop policy if exists "vh_categories_public_read" on public.vh_categories;
drop policy if exists "vh_categories_admin_all" on public.vh_categories;
create policy "vh_categories_public_read" on public.vh_categories for select to anon, authenticated using (is_active or public.vh_is_admin());
create policy "vh_categories_admin_all" on public.vh_categories for all to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
grant select on public.vh_categories to anon, authenticated;
grant insert, update, delete on public.vh_categories to authenticated;
grant usage, select on sequence public.vh_categories_id_seq to authenticated;

create table if not exists public.vh_songs (
  id bigint generated by default as identity primary key,
  title text not null,
  artist text,
  audio_url text not null,
  storage_provider text not null default 'direct' check (storage_provider in ('direct','supabase','cloudflare_r2','backblaze_b2')),
  storage_path text,
  poster_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.vh_songs add column if not exists poster_url text;
alter table public.vh_songs add column if not exists storage_provider text not null default 'direct';
alter table public.vh_songs add column if not exists storage_path text;
alter table public.vh_songs drop constraint if exists vh_songs_storage_provider_check;
alter table public.vh_songs add constraint vh_songs_storage_provider_check
  check (storage_provider in ('direct','supabase','cloudflare_r2','backblaze_b2'));
alter table public.vh_songs enable row level security;
drop policy if exists "vh_songs_public_read" on public.vh_songs;
drop policy if exists "vh_songs_admin_all" on public.vh_songs;
create policy "vh_songs_public_read" on public.vh_songs for select to anon, authenticated using (is_published or public.vh_is_admin());
create policy "vh_songs_admin_all" on public.vh_songs for all to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
revoke select on public.vh_songs from anon;
grant select (
  id,title,artist,audio_url,storage_provider,storage_path,poster_url,is_published,created_at
) on public.vh_songs to anon;
grant select on public.vh_songs to authenticated;
grant insert, update, delete on public.vh_songs to authenticated;
grant usage, select on sequence public.vh_songs_id_seq to authenticated;

create table if not exists public.vh_site_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.vh_site_settings enable row level security;
drop policy if exists "vh_site_settings_public_read" on public.vh_site_settings;
drop policy if exists "vh_site_settings_admin_all" on public.vh_site_settings;
create policy "vh_site_settings_public_read" on public.vh_site_settings for select to anon, authenticated using (true);
create policy "vh_site_settings_admin_all" on public.vh_site_settings for all to authenticated using (public.vh_is_admin()) with check (public.vh_is_admin());
grant select on public.vh_site_settings to anon, authenticated;
grant insert, update, delete on public.vh_site_settings to authenticated;

-- Analytics event storage. No views are fabricated; events appear only after frontend tracking is connected.
create table if not exists public.vh_analytics_events (
  id bigint generated by default as identity primary key,
  event_type text not null check (event_type in ('page_view','content_view','play_click','download_click','request_submit')),
  content_id bigint references public.vh_content(id) on delete set null,
  session_tag text,
  created_at timestamptz not null default now()
);
alter table public.vh_analytics_events enable row level security;
drop policy if exists "vh_analytics_public_insert" on public.vh_analytics_events;
drop policy if exists "vh_analytics_admin_read" on public.vh_analytics_events;
create policy "vh_analytics_public_insert" on public.vh_analytics_events
for insert to anon, authenticated with check (event_type in ('page_view','content_view','play_click','download_click','request_submit'));
create policy "vh_analytics_admin_read" on public.vh_analytics_events
for select to authenticated using (public.vh_is_admin());
grant insert on public.vh_analytics_events to anon, authenticated;
grant select on public.vh_analytics_events to authenticated;
grant usage, select on sequence public.vh_analytics_events_id_seq to anon, authenticated;
-- Public popularity is returned only as aggregate counts; raw sessions remain admin-only.
create or replace function public.vh_get_popular_content(p_limit integer default 10)
returns table(content_id bigint, view_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.content_id, count(*)::bigint as view_count
  from public.vh_analytics_events e
  join public.vh_content c on c.id = e.content_id
  where e.event_type = 'content_view'
    and e.content_id is not null
    and e.created_at >= now() - interval '30 days'
    and c.published = true
  group by e.content_id
  order by count(*) desc, max(e.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
revoke all on function public.vh_get_popular_content(integer) from public;
grant execute on function public.vh_get_popular_content(integer) to anon, authenticated;

-- Supabase public media bucket; uploads/deletes restricted to admins.
insert into storage.buckets (id, name, public) values ('vh-media','vh-media',true)
on conflict (id) do update set public = true;
drop policy if exists "Public can view published media" on storage.objects;
drop policy if exists "Admins can upload media" on storage.objects;
drop policy if exists "Admins can update media" on storage.objects;
drop policy if exists "Admins can delete media" on storage.objects;
drop policy if exists "vh_media_public_read" on storage.objects;
drop policy if exists "vh_media_admin_insert" on storage.objects;
drop policy if exists "vh_media_admin_update" on storage.objects;
drop policy if exists "vh_media_admin_delete" on storage.objects;
create policy "vh_media_public_read" on storage.objects for select to anon, authenticated using (bucket_id = 'vh-media');
create policy "vh_media_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'vh-media' and public.vh_is_admin());
create policy "vh_media_admin_update" on storage.objects for update to authenticated using (bucket_id = 'vh-media' and public.vh_is_admin()) with check (bucket_id = 'vh-media' and public.vh_is_admin());
create policy "vh_media_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'vh-media' and public.vh_is_admin());

-- Promote the known owner account to admin. This UUID must match the owner's Supabase Auth user.
do $$
begin
  if not exists (select 1 from auth.users where id = '1c68e22e-70d6-49ac-ba96-75784dc043e9'::uuid) then
    raise exception 'Admin Auth UUID not found. Stop and verify the Auth user UUID before continuing.';
  end if;
end $$;
insert into public.profiles (id, fullname, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'fullname', 'BunnyHub Admin'), 'admin'
from auth.users where id = '1c68e22e-70d6-49ac-ba96-75784dc043e9'::uuid
on conflict (id) do update set role = 'admin';

commit;

-- Verification queries (run separately after successful setup):
-- select id, fullname, role from public.profiles where id = '1c68e22e-70d6-49ac-ba96-75784dc043e9';
-- select tablename from pg_tables where schemaname='public' and tablename like 'vh_%' order by tablename;
