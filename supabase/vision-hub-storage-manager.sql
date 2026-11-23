-- BunnyHub Storage Manager migration
-- Run once in Supabase Dashboard > SQL Editor.
-- Stores only the selected provider name; NEVER store API tokens or passwords here.

create table if not exists public.vh_storage_settings (
  id smallint primary key default 1 check (id = 1),
  default_provider text not null default 'backblaze_b2'
    check (default_provider in ('supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.vh_storage_settings enable row level security;

drop policy if exists "Admins can read storage settings" on public.vh_storage_settings;
create policy "Admins can read storage settings" on public.vh_storage_settings
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins can insert storage settings" on public.vh_storage_settings;
create policy "Admins can insert storage settings" on public.vh_storage_settings
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins can update storage settings" on public.vh_storage_settings;
create policy "Admins can update storage settings" on public.vh_storage_settings
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

insert into public.vh_storage_settings (id, default_provider)
values (1, 'backblaze_b2')
on conflict (id) do nothing;

alter table public.vh_content
  add column if not exists storage_provider text not null default 'supabase';
