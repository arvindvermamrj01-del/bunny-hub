-- BunnyHub Phase 1: additive movie-detail metadata.
-- Safe to run on an existing project; does not drop or rewrite existing content.
alter table public.vh_content
  add column if not exists director text,
  add column if not exists screenshots text[] not null default '{}'::text[];

comment on column public.vh_content.director is 'Director or creator display metadata';
comment on column public.vh_content.screenshots is 'Authorised screenshot/preview image URLs for the detail page';
