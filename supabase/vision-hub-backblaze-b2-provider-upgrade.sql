-- BunnyHub: enable Backblaze B2 as a first-class storage provider.
-- Additive and safe for existing rows; keeps Supabase/R2 and legacy providers.
begin;

alter table public.vh_storage_settings
  drop constraint if exists vh_storage_settings_default_provider_check;
alter table public.vh_storage_settings
  add constraint vh_storage_settings_default_provider_check
  check (default_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram'
  ));

-- Make B2 the default for newly created settings rows and migrate the legacy default once.
alter table public.vh_storage_settings
  alter column default_provider set default 'backblaze_b2';

-- New content and media rows also default to B2 unless a legacy provider is
-- explicitly selected by the caller. Existing rows retain their provider.
alter table public.vh_content
  alter column storage_provider set default 'backblaze_b2';
alter table public.vh_media_assets
  alter column storage_provider set default 'backblaze_b2';
update public.vh_storage_settings
  set default_provider='backblaze_b2', updated_at=now()
  where id=1 and default_provider='supabase';

-- Content metadata and individual media assets must accept B2 as well.
alter table public.vh_content
  drop constraint if exists vh_content_storage_provider_check;
alter table public.vh_content
  add constraint vh_content_storage_provider_check
  check (storage_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram','direct'
  ));

alter table public.vh_media_assets
  drop constraint if exists vh_media_assets_storage_provider_check;
alter table public.vh_media_assets
  add constraint vh_media_assets_storage_provider_check
  check (storage_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram','direct'
  ));

commit;
