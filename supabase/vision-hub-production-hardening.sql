-- BunnyHub production database hardening
-- Apply AFTER the master, platform and feature upgrade scripts and after the
-- private RLS helper functions from PR #12 exist.
-- This file targets the current combined legacy + VH production schema.
-- It is idempotent and changes policies/constraints/indexes only; it does not
-- insert, update or delete catalogue/user rows or change the default provider.

BEGIN;

-- 1) Permit Backblaze B2 everywhere the database validates storage providers.
ALTER TABLE public.vh_content
  DROP CONSTRAINT IF EXISTS vh_content_storage_provider_check;
ALTER TABLE public.vh_content
  ADD CONSTRAINT vh_content_storage_provider_check
  CHECK (storage_provider = ANY (ARRAY[
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr',
    'internxt','telegram','direct'
  ]::text[]));

ALTER TABLE public.vh_media_assets
  DROP CONSTRAINT IF EXISTS vh_media_assets_storage_provider_check;
ALTER TABLE public.vh_media_assets
  ADD CONSTRAINT vh_media_assets_storage_provider_check
  CHECK (storage_provider = ANY (ARRAY[
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr',
    'internxt','telegram','direct'
  ]::text[]));

ALTER TABLE public.vh_storage_settings
  DROP CONSTRAINT IF EXISTS vh_storage_settings_default_provider_check;
ALTER TABLE public.vh_storage_settings
  ADD CONSTRAINT vh_storage_settings_default_provider_check
  CHECK (default_provider = ANY (ARRAY[
    'supabase','cloudflare_r2','backblaze_b2','terabox','mega','degoo',
    'google_drive','mediafire','pcloud','box','icedrive','koofr','internxt','telegram'
  ]::text[]));

-- Deliberately do not change vh_storage_settings.default_provider.

-- 2) Index the foreign-key columns identified by the Performance Advisor.
CREATE INDEX IF NOT EXISTS content_created_by_idx
  ON public.content (created_by);
CREATE INDEX IF NOT EXISTS movie_requests_user_id_idx
  ON public.movie_requests (user_id);
CREATE INDEX IF NOT EXISTS requests_user_id_idx
  ON public.requests (user_id);
CREATE INDEX IF NOT EXISTS vh_analytics_events_content_id_idx
  ON public.vh_analytics_events (content_id);
CREATE INDEX IF NOT EXISTS vh_content_created_by_idx
  ON public.vh_content (created_by);
CREATE INDEX IF NOT EXISTS vh_media_assets_created_by_idx
  ON public.vh_media_assets (created_by);
CREATE INDEX IF NOT EXISTS vh_requests_assigned_to_idx
  ON public.vh_requests (assigned_to);
CREATE INDEX IF NOT EXISTS vh_requests_reviewed_by_idx
  ON public.vh_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS vh_site_settings_updated_by_idx
  ON public.vh_site_settings (updated_by);
CREATE INDEX IF NOT EXISTS vh_songs_created_by_idx
  ON public.vh_songs (created_by);
CREATE INDEX IF NOT EXISTS vh_storage_settings_updated_by_idx
  ON public.vh_storage_settings (updated_by);
CREATE INDEX IF NOT EXISTS watchlist_movie_id_idx
  ON public.watchlist (movie_id);

-- 3) Trigger handlers are invoked by their triggers, not through the Data API.
-- Revoke direct role execution while preserving trigger behaviour.
DO $vh_revoke_trigger_exec$
DECLARE
  routine record;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'prevent_profile_role_escalation',
        'handle_new_user',
        'handle_new_BUNNY_HUB_user',
        'vh_guard_profile_role',
        'vh_handle_new_user',
        'rls_auto_enable'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      routine.signature
    );
  END LOOP;
END
$vh_revoke_trigger_exec$;

ALTER FUNCTION public.prevent_profile_role_escalation() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- 4) Remove overlapping legacy content/request policies while preserving the
-- exact effective user/admin permissions of the existing policy combinations.
DROP POLICY IF EXISTS "Admins manage content" ON public.content;
DROP POLICY IF EXISTS "vh_content_admin_insert" ON public.content;
DROP POLICY IF EXISTS "vh_content_admin_update" ON public.content;
DROP POLICY IF EXISTS "vh_content_admin_delete" ON public.content;
CREATE POLICY "vh_content_admin_insert" ON public.content
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());
CREATE POLICY "vh_content_admin_update" ON public.content
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "vh_content_admin_delete" ON public.content
  FOR DELETE TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS "Admins review requests" ON public.movie_requests;
DROP POLICY IF EXISTS "Users submit own requests" ON public.movie_requests;
DROP POLICY IF EXISTS "Users create and read own requests" ON public.movie_requests;
DROP POLICY IF EXISTS "vh_movie_requests_select" ON public.movie_requests;
DROP POLICY IF EXISTS "vh_movie_requests_insert" ON public.movie_requests;
DROP POLICY IF EXISTS "vh_movie_requests_update" ON public.movie_requests;
DROP POLICY IF EXISTS "vh_movie_requests_delete" ON public.movie_requests;
CREATE POLICY "vh_movie_requests_select" ON public.movie_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_admin());
CREATE POLICY "vh_movie_requests_insert" ON public.movie_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR private.is_admin());
CREATE POLICY "vh_movie_requests_update" ON public.movie_requests
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
CREATE POLICY "vh_movie_requests_delete" ON public.movie_requests
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- 5) Consolidate category permissions. Anon/authenticated SELECT policies are
-- disjoint; catalog staff retain admin/sub-admin management access.
DROP POLICY IF EXISTS "catalog staff manage categories" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_admin_all" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_public_read" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_public_read_anon" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_public_read_authenticated" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_staff_insert" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_staff_update" ON public.vh_categories;
DROP POLICY IF EXISTS "vh_categories_staff_delete" ON public.vh_categories;
CREATE POLICY "vh_categories_public_read_anon" ON public.vh_categories
  FOR SELECT TO anon
  USING (is_active OR private.vh_is_admin());
CREATE POLICY "vh_categories_public_read_authenticated" ON public.vh_categories
  FOR SELECT TO authenticated
  USING (is_active OR private.vh_can_manage_catalog());
CREATE POLICY "vh_categories_staff_insert" ON public.vh_categories
  FOR INSERT TO authenticated
  WITH CHECK (private.vh_can_manage_catalog());
CREATE POLICY "vh_categories_staff_update" ON public.vh_categories
  FOR UPDATE TO authenticated
  USING (private.vh_can_manage_catalog())
  WITH CHECK (private.vh_can_manage_catalog());
CREATE POLICY "vh_categories_staff_delete" ON public.vh_categories
  FOR DELETE TO authenticated
  USING (private.vh_can_manage_catalog());

-- 6) Consolidate content management/read access. The authenticated policy
-- deliberately preserves the union of both original staff policies.
DROP POLICY IF EXISTS "staff manage content" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_staff_all" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_public_read" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_public_read_anon" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_public_read_authenticated" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_staff_insert" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_staff_update" ON public.vh_content;
DROP POLICY IF EXISTS "vh_content_staff_delete" ON public.vh_content;
CREATE POLICY "vh_content_public_read_anon" ON public.vh_content
  FOR SELECT TO anon
  USING (published = true OR private.vh_is_admin());
CREATE POLICY "vh_content_public_read_authenticated" ON public.vh_content
  FOR SELECT TO authenticated
  USING (
    published = true
    OR private.vh_is_admin()
    OR private.vh_can_manage_content_item(content_type)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.role IN ('admin','sub_admin')
          OR (p.role = 'content_editor' AND vh_content.content_type <> 'Short')
        )
    )
  );
CREATE POLICY "vh_content_staff_insert" ON public.vh_content
  FOR INSERT TO authenticated
  WITH CHECK (
    private.vh_can_manage_content_item(content_type)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.role IN ('admin','sub_admin')
          OR (p.role = 'content_editor' AND vh_content.content_type <> 'Short')
        )
    )
  );
CREATE POLICY "vh_content_staff_update" ON public.vh_content
  FOR UPDATE TO authenticated
  USING (
    private.vh_can_manage_content_item(content_type)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.role IN ('admin','sub_admin')
          OR (p.role = 'content_editor' AND vh_content.content_type <> 'Short')
        )
    )
  )
  WITH CHECK (
    private.vh_can_manage_content_item(content_type)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.role IN ('admin','sub_admin')
          OR (p.role = 'content_editor' AND vh_content.content_type <> 'Short')
        )
    )
  );
CREATE POLICY "vh_content_staff_delete" ON public.vh_content
  FOR DELETE TO authenticated
  USING (
    private.vh_can_manage_content_item(content_type)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.role IN ('admin','sub_admin')
          OR (p.role = 'content_editor' AND vh_content.content_type <> 'Short')
        )
    )
  );

-- 7) Media asset SELECT policies are role-separated. The staff helper covers
-- admin/sub-admin/editor access; the former admin-only ALL policy was redundant.
DROP POLICY IF EXISTS "main admins manage media tracks" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_staff_all" ON public.vh_media_assets;
DROP POLICY IF EXISTS "published media tracks readable" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_public_read" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_read_anon" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_read_authenticated" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_staff_insert" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_staff_update" ON public.vh_media_assets;
DROP POLICY IF EXISTS "vh_media_assets_staff_delete" ON public.vh_media_assets;
CREATE POLICY "vh_media_assets_read_anon" ON public.vh_media_assets
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.vh_content c
      WHERE c.id = vh_media_assets.content_id AND c.published = true
    )
    OR private.vh_is_admin()
  );
CREATE POLICY "vh_media_assets_read_authenticated" ON public.vh_media_assets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vh_content c
      WHERE c.id = vh_media_assets.content_id AND c.published = true
    )
    OR private.vh_is_admin()
    OR private.vh_can_manage_content_item(content_id)
  );
CREATE POLICY "vh_media_assets_staff_insert" ON public.vh_media_assets
  FOR INSERT TO authenticated
  WITH CHECK (private.vh_can_manage_content_item(content_id));
CREATE POLICY "vh_media_assets_staff_update" ON public.vh_media_assets
  FOR UPDATE TO authenticated
  USING (private.vh_can_manage_content_item(content_id))
  WITH CHECK (private.vh_can_manage_content_item(content_id));
CREATE POLICY "vh_media_assets_staff_delete" ON public.vh_media_assets
  FOR DELETE TO authenticated
  USING (private.vh_can_manage_content_item(content_id));

-- 8) Requests preserve guest pending inserts, authenticated owner inserts,
-- owner/staff SELECT, and staff-only UPDATE/DELETE.
DROP POLICY IF EXISTS "staff manage requests" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_staff_delete" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_staff_select" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_staff_update" ON public.vh_requests;
DROP POLICY IF EXISTS "Users can submit requests for themselves" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_public_insert" ON public.vh_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_insert_anon" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_insert_authenticated" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_select_authenticated" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_update_staff" ON public.vh_requests;
DROP POLICY IF EXISTS "vh_requests_delete_staff" ON public.vh_requests;
CREATE POLICY "vh_requests_insert_anon" ON public.vh_requests
  FOR INSERT TO anon
  WITH CHECK (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL);
CREATE POLICY "vh_requests_insert_authenticated" ON public.vh_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id IS NULL
    OR requester_id = (SELECT auth.uid())
    OR (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR private.vh_can_manage_requests()
  );
CREATE POLICY "vh_requests_select_authenticated" ON public.vh_requests
  FOR SELECT TO authenticated
  USING (
    requester_id = (SELECT auth.uid())
    OR private.vh_can_manage_requests()
  );
CREATE POLICY "vh_requests_update_staff" ON public.vh_requests
  FOR UPDATE TO authenticated
  USING (private.vh_can_manage_requests())
  WITH CHECK (private.vh_can_manage_requests());
CREATE POLICY "vh_requests_delete_staff" ON public.vh_requests
  FOR DELETE TO authenticated
  USING (private.vh_can_manage_requests());

-- 9) Public site settings were already readable to everyone; retain that
-- behaviour and split administrator mutations into separate commands.
DROP POLICY IF EXISTS "vh_site_settings_admin_all" ON public.vh_site_settings;
DROP POLICY IF EXISTS "vh_site_settings_admin_insert" ON public.vh_site_settings;
DROP POLICY IF EXISTS "vh_site_settings_admin_update" ON public.vh_site_settings;
DROP POLICY IF EXISTS "vh_site_settings_admin_delete" ON public.vh_site_settings;
CREATE POLICY "vh_site_settings_admin_insert" ON public.vh_site_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.vh_is_admin());
CREATE POLICY "vh_site_settings_admin_update" ON public.vh_site_settings
  FOR UPDATE TO authenticated
  USING (private.vh_is_admin())
  WITH CHECK (private.vh_is_admin());
CREATE POLICY "vh_site_settings_admin_delete" ON public.vh_site_settings
  FOR DELETE TO authenticated
  USING (private.vh_is_admin());

-- 10) Catalog staff already includes admins; avoid duplicated admin ALL rules.
DROP POLICY IF EXISTS "catalog staff manage songs" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_admin_all" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_public_read" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_read_anon" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_read_authenticated" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_staff_insert" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_staff_update" ON public.vh_songs;
DROP POLICY IF EXISTS "vh_songs_staff_delete" ON public.vh_songs;
CREATE POLICY "vh_songs_read_anon" ON public.vh_songs
  FOR SELECT TO anon
  USING (is_published OR private.vh_is_admin());
CREATE POLICY "vh_songs_read_authenticated" ON public.vh_songs
  FOR SELECT TO authenticated
  USING (is_published OR private.vh_can_manage_catalog());
CREATE POLICY "vh_songs_staff_insert" ON public.vh_songs
  FOR INSERT TO authenticated
  WITH CHECK (private.vh_can_manage_catalog());
CREATE POLICY "vh_songs_staff_update" ON public.vh_songs
  FOR UPDATE TO authenticated
  USING (private.vh_can_manage_catalog())
  WITH CHECK (private.vh_can_manage_catalog());
CREATE POLICY "vh_songs_staff_delete" ON public.vh_songs
  FOR DELETE TO authenticated
  USING (private.vh_can_manage_catalog());


-- 11) Keep public RPC entry points invoker-safe. Their SECURITY DEFINER
-- implementations live in the non-exposed private schema.
GRANT USAGE ON SCHEMA private TO anon, authenticated;
CREATE OR REPLACE FUNCTION private.vh_get_popular_content(p_limit integer DEFAULT 10)
RETURNS TABLE(content_id bigint, view_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.content_id, count(*)::bigint
  FROM public.vh_analytics_events e
  JOIN public.vh_content c ON c.id=e.content_id
  WHERE e.event_type='content_view' AND e.content_id IS NOT NULL
    AND e.created_at>=now()-interval '30 days'
    AND c.published=true AND c.content_type<>'Episode'
  GROUP BY e.content_id
  ORDER BY count(*) DESC,max(e.created_at) DESC
  LIMIT greatest(1,least(coalesce(p_limit,10),50));
$$;
REVOKE ALL ON FUNCTION private.vh_get_popular_content(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.vh_get_popular_content(integer) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.vh_get_popular_content(p_limit integer DEFAULT 10)
RETURNS TABLE(content_id bigint, view_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.vh_get_popular_content(p_limit);
$$;
REVOKE ALL ON FUNCTION public.vh_get_popular_content(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vh_get_popular_content(integer) TO anon,authenticated;

CREATE OR REPLACE FUNCTION private.vh_vote_feedback(p_feedback_id bigint)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_inserted bigint; v_votes integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to vote.'; END IF;
  INSERT INTO public.vh_feedback_votes(feedback_id,user_id)
  SELECT f.id,v_user FROM public.vh_feedback f
  WHERE f.id=p_feedback_id AND f.status IN ('planned','in_progress','completed')
  ON CONFLICT (feedback_id,user_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NOT NULL THEN
    UPDATE public.vh_feedback SET upvotes=upvotes+1,updated_at=now() WHERE id=p_feedback_id;
  END IF;
  SELECT upvotes INTO v_votes FROM public.vh_feedback WHERE id=p_feedback_id;
  IF v_votes IS NULL THEN RAISE EXCEPTION 'Feedback item not found.'; END IF;
  RETURN v_votes;
END;
$$;
REVOKE ALL ON FUNCTION private.vh_vote_feedback(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.vh_vote_feedback(bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.vh_vote_feedback(p_feedback_id bigint)
RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.vh_vote_feedback(p_feedback_id);
$$;
REVOKE ALL ON FUNCTION public.vh_vote_feedback(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vh_vote_feedback(bigint) TO authenticated;

-- 12) Consolidate community-board SELECT policies by role, and index all
-- remaining foreign keys added by the feature migrations.
DROP POLICY IF EXISTS "vh_feedback_public_board" ON public.vh_feedback;
DROP POLICY IF EXISTS "vh_feedback_owner_read" ON public.vh_feedback;
DROP POLICY IF EXISTS "vh_feedback_admin_read" ON public.vh_feedback;
DROP POLICY IF EXISTS "vh_feedback_authenticated_read" ON public.vh_feedback;
CREATE POLICY "vh_feedback_public_board" ON public.vh_feedback
  FOR SELECT TO anon
  USING (status IN ('planned','in_progress','completed'));
CREATE POLICY "vh_feedback_authenticated_read" ON public.vh_feedback
  FOR SELECT TO authenticated
  USING (status IN ('planned','in_progress','completed')
    OR user_id=(SELECT auth.uid()) OR public.vh_is_admin());
CREATE INDEX IF NOT EXISTS vh_donations_verified_by_idx ON public.vh_donations(verified_by);
CREATE INDEX IF NOT EXISTS vh_feedback_votes_user_id_idx ON public.vh_feedback_votes(user_id);

-- 13) Include download-link clicks in the allowed first-party analytics events.
ALTER TABLE public.vh_analytics_events
  DROP CONSTRAINT IF EXISTS vh_analytics_events_event_type_check;
ALTER TABLE public.vh_analytics_events
  ADD CONSTRAINT vh_analytics_events_event_type_check
  CHECK (event_type IN ('page_view','content_view','play_click','download_click','request_submit'));
DROP POLICY IF EXISTS "vh_analytics_public_insert" ON public.vh_analytics_events;
CREATE POLICY "vh_analytics_public_insert" ON public.vh_analytics_events
  FOR INSERT TO anon,authenticated
  WITH CHECK (event_type IN ('page_view','content_view','play_click','download_click','request_submit'));

COMMIT;
