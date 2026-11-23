-- BunnyHub: add requested cloud storage providers to the admin provider selector.
-- Run once in Supabase Dashboard > SQL Editor before selecting these providers.
-- Stores provider names only; never store provider passwords or API tokens here.
alter table public.vh_storage_settings
  drop constraint if exists vh_storage_settings_default_provider_check;
alter table public.vh_storage_settings
  add constraint vh_storage_settings_default_provider_check
  check (default_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo','google_drive','mediafire',
    'pcloud','box','icedrive','koofr','internxt','telegram'
  ));
