-- BunnyHub media asset metadata extension.
-- Safe additive migration: preserves existing rows, policies, and storage buckets.
alter table public.vh_media_assets
  add column if not exists resolution text,
  add column if not exists language text,
  add column if not exists is_primary boolean not null default false;

create index if not exists vh_media_assets_content_id_idx
  on public.vh_media_assets (content_id);

-- Existing private bucket and its RLS policies are intentionally unchanged.
