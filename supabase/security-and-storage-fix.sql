-- BunnyHub hardening migration. Run in Supabase SQL Editor.
-- Prevent authenticated users from changing their own role through any permissive UPDATE policy.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.role is distinct from old.role then
    if auth.uid() is null then
      return new; -- trusted service-role / SQL-editor operations
    end if;

    select p.role
      into actor_role
      from public.profiles as p
     where p.id = auth.uid();

    if actor_role is distinct from 'admin' then
      raise exception 'Only an administrator may change profile roles'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update of role on public.profiles
for each row
execute function public.prevent_profile_role_escalation();

-- Keep the Admin storage selector and database constraint in sync.
alter table public.vh_storage_settings
  drop constraint if exists vh_storage_settings_default_provider_check;
alter table public.vh_storage_settings
  add constraint vh_storage_settings_default_provider_check
  check (default_provider in (
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram'
  ));
