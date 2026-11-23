-- Private audio storage metadata for the public song library.
begin;

alter table public.vh_songs
  add column if not exists storage_provider text not null default 'direct',
  add column if not exists storage_path text;

alter table public.vh_songs
  drop constraint if exists vh_songs_storage_provider_check;
alter table public.vh_songs
  add constraint vh_songs_storage_provider_check
  check (storage_provider in ('direct','supabase','cloudflare_r2','backblaze_b2'));

create index if not exists vh_songs_storage_lookup_idx
  on public.vh_songs(storage_provider,storage_path)
  where storage_path is not null;

commit;
