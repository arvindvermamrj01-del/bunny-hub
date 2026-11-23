-- BunnyHub: keep internal creator/requester IDs out of anonymous catalog and community reads.
-- Public catalog and board fields remain available; authenticated staff retain full table access.
begin;

revoke select on public.vh_content from anon;
grant select (
  id,title,content_type,video_url,poster_url,genre,language,release_year,rating,
  description,"cast",duration,trailer_url,industry,published,created_at,storage_provider,
  telegram_url,is_featured,subtitle_tracks,director,screenshots,
  parent_series_id,season_number,episode_number
) on public.vh_content to anon;
grant select on public.vh_content to authenticated;

revoke select on public.vh_songs from anon;
grant select (
  id,title,artist,audio_url,storage_provider,storage_path,poster_url,is_published,created_at
) on public.vh_songs to anon;
grant select on public.vh_songs to authenticated;

revoke select on public.vh_feedback from anon;
grant select (id,category,title,description,status,admin_response,upvotes,created_at,updated_at)
  on public.vh_feedback to anon;
grant select,insert,update on public.vh_feedback to authenticated;

commit;
