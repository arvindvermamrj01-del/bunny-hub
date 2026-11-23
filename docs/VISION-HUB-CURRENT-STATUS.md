# BunnyHub — Current Production Status
**Snapshot:** 21 November 2026, 05:05 UTC onward  
**Purpose:** truthful working status; supersedes older checklist snapshots where their production facts conflict.

## Master portfolio and permission plan
- Complete workstream chart, implementation vs verification status, role matrix, upload test sequence, owner permissions and remaining priorities: [BunnyHub Master Feature Portfolio](bunnyhub-MASTER-PORTFOLIO.md).

## Full project chart
- Complete start-to-launch map: [BunnyHub Full Project Chart](bunnyhub-FULL-PROJECT-CHART.md). It documents the original scope, hosting/domain setup, Supabase/B2 architecture, all upload paths, role permissions and final publishing gates.

## Production deployment
- Cloudflare Pages project: `bunnyhub`, automatic deployment from GitHub `main`.
- Latest verified Production deployment at snapshot: [`1006b1b9`](https://1006b1b9.bunnyhub.pages.dev), commit `f936f24d84127161c8c17deeb49c29b68ab35971`; Cloudflare build and deploy completed successfully.
- Production alias: https://bunnyhub.pages.dev
- Cloudflare Pages has no custom domain attached at this snapshot; current public hostname is the pages.dev address.
- Recent merged fixes: PR #17 movie MIME/B2 defaults, PR #18 migration consistency, PR #19 episode/audio MIME detection, PR #20 Original video resolution, PR #21 episode Original resolution, PR #22 B2 defaults and donation cap, PR #23 current-status documentation and RPC/RLS hardening, PR #24 status refresh, PR #25 master portfolio, PR #26 full start-to-launch project chart.
- No approved homepage, movie-detail popup, player or navigation layout was redesigned in this batch.

## Movie-upload failure — root causes found and fixed
1. **Main Video Only was guaranteed to fail at metadata save.** The Admin code changed `Original` to SQL `NULL`, while Production requires a non-null video resolution and did not allow `original`. The upload could reach object storage, then fail while inserting `vh_media_assets`, after which cleanup removed the uploaded object. The app now stores `original`, the database constraint accepts it, and the player displays “Original”.
2. **B2 was configured but not actually selected by the live default.** The storage settings row and column defaults were still `supabase`. The live row and defaults for `vh_storage_settings`, `vh_content` and `vh_media_assets` are now `backblaze_b2`.
3. **Browser MIME detection rejected some valid video/audio files.** Movie, episode and song upload code now infers supported MIME types from file extensions when the browser reports an empty or generic type. The inferred Content-Type is used consistently for signing and upload.
4. **Episode schema was incomplete.** Production lacked the series parent/season/episode columns and still rejected `content_type='Episode'`. The additive series/episode migration is now applied, including parent validation and unique episode ordering. Episode source quality defaults to `original`.

### Upload-related checks completed
- Production B2 server-variable names are present in Pages configuration; secret values remain private.
- B2 is the database default for new uploads.
- Production database CHECK constraints now accept B2 and `original`.
- Rollback-only SQL insert tests successfully created and then rolled back a Main Video asset with `resolution='original'`, and a Web Series → Episode → Original media asset chain.
- These SQL tests validate schema/constraints, **not** an authenticated browser upload or playback.
- **Still pending:** real Admin-session app flow: browser selects file → signed B2 PUT → content/media rows → signed GET/playback → delete. No claim of successful app E2E is made without the real authenticated Admin session.

## Production database state
- Correct Production Supabase project ref: `bmtbsguwbbeuvmvdfdyb`.
- B2 defaults verified:
  - `vh_storage_settings.default_provider = backblaze_b2`
  - `vh_content.storage_provider` default = `backblaze_b2`
  - `vh_media_assets.storage_provider` default = `backblaze_b2`
- Production tables include legacy tables plus `vh_content`, `vh_media_assets`, `vh_categories`, `vh_songs`, `vh_requests`, `vh_storage_settings`, `vh_site_settings`, `vh_analytics_events`, `vh_user_watchlist`, `vh_watch_progress`, `vh_donations`, `vh_feedback` and `vh_feedback_votes`. Episode columns and constraints are now present.
- Current catalog/media/song/category/request/donation/community rows are empty; analytics events and site/storage settings are present. No fake or commercial copyrighted sample catalogue was inserted.
- Donations now have a ₹1–₹999 database cap, matching the public form.
- Popular-content RPC is available; download-click is an allowed analytics event.
- Community voting is authenticated-only; anonymous users cannot call the vote RPC.

## Database advisor results after the fixes
- Security Advisor: only the Free-plan leaked-password-protection warning remains. It cannot be enabled on the current Free plan; no plan upgrade is being requested.
- Performance Advisor: no multiple-permissive-policy warning and no unindexed-foreign-key warning remain. Remaining findings are unused-index INFO notices; indexes were not dropped.
- Health Advisor: no findings.
- Public RPC wrappers now run as invoker-safe functions; privileged implementations are in the non-exposed `private` schema.

## Safe production configuration
- AdSense has been switched off because publisher ID and slot IDs are not configured; it must remain off until approval and configuration.
- UPI ID and QR URL are not configured, so donation submission remains unavailable until the owner configures them.
- Pages Production currently contains Supabase, B2 and Admin-session secret variable names. R2, PixelDrain, Google Drive, Telegram bot and AdSense OAuth secrets are not present in the Production variable-name list.
- B2 remains private; Supabase private media remains supported for legacy objects.
- Current direct single-PUT video limit is 5 GB; multipart/resumable upload above 5 GB is not implemented. Audio upload is capped at 1 GB.
- Google Drive import is limited to public shared-file links; private/folder import and Drive-to-B2 copy are not implemented.
- TeraBox/MEGA/other unconfigured providers remain authorised-link based, not direct-upload integrations.

## Remaining work — in order
1. **Authenticated upload/playback E2E:** real Admin session; test one authorised small movie, one MKV/other extension fallback, one episode, then verify signed playback and delete with no orphan rows/objects.
2. **Auth/email:** re-test signup, email confirmation, password reset and session expiry; SMTP delivery had previously failed and is not signed off.
3. **Catalog workflows:** movie/series/episode/short/song create-edit-unpublish-delete, search/filter, quality selector, subtitle, download, watchlist and continue-watching.
4. **Community/donations:** member feedback submission/vote/moderation; UPI settings and manual verification after UPI ID/QR are configured.
5. **External integrations:** Telegram webhook/notifications, Google Drive public-file import, optional R2, AdSense approval/slots/OAuth and consent management.
6. **Security-session verification:** positive/negative role tests, one-hour Admin cookie expiry, rate-limit lockout and Main-Admin-only activity view.
7. **Final QA:** real desktop/mobile viewport, accessibility, browser console/network, performance/Lighthouse, SEO, RLS/IDOR and backup/restore review.

## Completion rule
A feature is marked **Verified** only after a real end-to-end check. Code present or credentials configured alone are not proof. Report each remaining item as PASS, FAIL (then fix), or BLOCKED with its exact external dependency.
