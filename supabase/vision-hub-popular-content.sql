-- Aggregate public popularity without exposing raw analytics events or session tags.
begin;

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
    and c.content_type <> 'Episode'
  group by e.content_id
  order by count(*) desc, max(e.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.vh_get_popular_content(integer) from public;
grant execute on function public.vh_get_popular_content(integer) to anon, authenticated;

commit;
