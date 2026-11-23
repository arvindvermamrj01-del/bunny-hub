-- BunnyHub series seasons and episodes.
-- Episodes are catalog rows so existing private-media signing, watch progress and player quality code can be reused.
begin;

alter table public.vh_content
  add column if not exists parent_series_id bigint references public.vh_content(id) on delete cascade,
  add column if not exists season_number integer,
  add column if not exists episode_number integer;

-- Replace only the original content-type allow-list constraint.
-- Do not remove unrelated/custom CHECK constraints that happen to reference content_type.
alter table public.vh_content
  drop constraint if exists vh_content_content_type_check;

alter table public.vh_content
  add constraint vh_content_content_type_check
  check (content_type in ('Movie','Web Series','Documentary','Short','Episode'));

alter table public.vh_content
  drop constraint if exists vh_content_episode_metadata_check;
alter table public.vh_content
  add constraint vh_content_episode_metadata_check
  check (
    content_type <> 'Episode'
    or (
      parent_series_id is not null
      and season_number is not null and season_number >= 1
      and episode_number is not null and episode_number >= 1
    )
  );

create or replace function public.vh_validate_episode_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_type text;
begin
  if new.content_type = 'Episode' then
    select content_type into v_parent_type
    from public.vh_content
    where id = new.parent_series_id;
    if v_parent_type is distinct from 'Web Series' then
      raise exception 'Episode parent must be an existing Web Series.';
    end if;
  end if;
  if tg_op = 'UPDATE'
     and old.content_type = 'Web Series'
     and new.content_type <> 'Web Series'
     and exists (select 1 from public.vh_content e where e.parent_series_id = old.id and e.content_type = 'Episode') then
    raise exception 'Remove or reassign this series'' episodes before changing its content type.';
  end if;
  return new;
end;
$$;

drop trigger if exists vh_validate_episode_parent_trigger on public.vh_content;
create trigger vh_validate_episode_parent_trigger
before insert or update of content_type,parent_series_id
on public.vh_content
for each row execute function public.vh_validate_episode_parent();

create unique index if not exists vh_content_series_episode_unique
  on public.vh_content(parent_series_id,season_number,episode_number)
  where content_type='Episode';
create index if not exists vh_content_series_episode_order_idx
  on public.vh_content(parent_series_id,season_number,episode_number)
  where content_type='Episode';

-- Episode uploads use the same private providers and may also use authorised external URLs.
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
