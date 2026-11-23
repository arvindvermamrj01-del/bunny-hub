# BunnyHub — Master Feature Portfolio & Completion Chart

> **Start-to-launch project map:** read [BunnyHub Full Project Chart](bunnyhub-FULL-PROJECT-CHART.md) first for the original end-to-end plan, where each hosting/database/storage service is used, how catalog data is uploaded, the current publication setup and the complete final sign-off sequence.

**Status snapshot:** 21 November 2026  
**Source of truth:** this document combines the older completion roadmap, Cinema4U feature comparison, master feature matrix and the latest Production checks. It distinguishes code present, database/configuration present and true end-to-end verification.

## 1. Executive status

BunnyHub का core platform, approved Cinema4U-style discovery layout, Admin Control Center, Supabase backend, Cloudflare Pages APIs, private media architecture, account features and integrations का code मौजूद है। Recent work ने Movie upload की वास्तविक database failure, B2 default mismatch, MIME detection और Episode schema gaps को ठीक किया है।

**Current Production:** https://bunnyhub.pages.dev  
**Latest verified deployment:** 1006b1b9  
**Commit:** f936f24d84127161c8c17deeb49c29b68ab35971  
**Cloudflare:** Production build और deploy सफल  
**GitHub:** PR #17–#25 merged at this snapshot; PR #26 adds the complete start-to-launch infrastructure and launch chart.

### Status meaning

| Status | Meaning |
|---|---|
| **DONE / DEPLOYED** | Code change is merged and the relevant Production migration/deployment is confirmed. |
| **CONFIGURED** | Provider/server settings exist, but a complete app workflow has not been proven. |
| **CODE READY — E2E PENDING** | Code/schema exists; real browser, account or provider test remains. |
| **BLOCKED — OWNER SETUP** | An owner-controlled credential, account setting, legal approval or source asset is missing. |
| **NOT IMPLEMENTED** | Capability is not currently available and must not be advertised as working. |

Do not calculate a completion percentage from code presence alone. A feature becomes **Verified** only after its full workflow passes.

## 2. Master feature completion chart

| Workstream | What was planned / built | Current status | What remains |
|---|---|---|---|
| Approved website UI | Cinema4U-style discovery, existing homepage, navigation, movie-detail popup, player, desktop sidebar, mobile dock and theme options | **DONE / PRESERVED**; no redesign in the latest batch | Final desktop + real mobile viewport and accessibility checks; any major redesign still needs a preview first |
| Home discovery | Latest entries, popular content, genres, release-year/language filters, sort, search and catalogue rails | **CODE READY**; popularity RPC is in Production | Rails are empty because there is no published catalogue; verify sort/filter after content is loaded |
| Movies | Movie metadata, poster, description, actors/director, trailer, language, genre, year, primary source and alternate quality assets | **DONE / DEPLOYED**; Original quality bug fixed | Actual Admin create/edit/unpublish/delete + player test |
| Web Series | Series catalogue, parent relationship and series grouping | **DONE / DEPLOYED**; Episode schema migration applied | Real Series creation and public detail test |
| Seasons & Episodes | Season/episode numbers, parent validation, unique ordering, primary source, alternate quality links and cleanup | **DONE / DEPLOYED**; Episode type and Original quality fixed | Real Episode upload, playback, next-episode and deletion tests |
| Documentaries / Shows | Catalogue type and metadata use the core content workflow | **CODE READY** | Create and browse an authorised sample |
| Shorts | Short video catalogue, upload and player support | **CODE READY**; B2 default and MIME support shared with movies | Real Short upload/playback/delete; check editor restrictions |
| Music / Songs | Song library, metadata, direct HTTPS links and private B2/R2 audio upload/access/delete | **CODE READY**; audio MIME fallback fixed; 1 GB max | Real audio upload, playback and delete; B2/R2 credentials required |
| Video quality / Original | Original + 180p–8K option model, media asset table, quality selector | **DONE / DEPLOYED**; Original no longer becomes NULL | Verify real source quality selection; do not create fake alternate qualities |
| Private video access | Published-content check, linked media-asset check and short-lived signed read URL | **CODE READY** | Real signed playback and download tests for each configured provider |
| Video download | Signed attachment path for supported private providers and actual supplied download links | **CODE READY** | Verify correct file, expiry and browser download behavior |
| Subtitles / playback progress | Subtitle metadata, speed controls, resume position and continue-watching flow | **CODE READY** | Verify an authorised WebVTT subtitle, saved progress and resume across sessions |
| Backblaze B2 | Private bucket, server-side keys, signed PUT/GET/DELETE, upload URL API, default provider and B2 health-check endpoint | **CONFIGURED + DB DEFAULT DONE**; provider-level temporary PUT/GET/DELETE test was previously successful and test object removed | Real application upload → database link → signed playback → delete. This is the highest priority remaining test |
| Cloudflare R2 | Alternative S3-compatible signed upload/read/delete code | **CODE READY, NOT CONFIGURED** | Only configure/test if the owner wants R2; Production R2 variables are absent |
| Supabase Storage | Private legacy bucket and existing media path retained | **LEGACY SUPPORT RETAINED** | Verify a real legacy object still reads; do not migrate or delete legacy files as part of this test |
| PixelDrain | In-app upload/delete code and external link support | **CODE READY, NOT CONFIGURED**; in-app upload limit is 90 MiB | Add the provider key only if desired; larger files should use B2 or R2 |
| Google Drive | Admin import of one public shared video file using Drive API | **CODE READY, NOT CONFIGURED** | Restricted Google Drive API key and one public-file test; private/folder import and Drive-to-B2 copy are not implemented |
| Other storage providers | Provider names/URL options for external sources | **LINK-ONLY unless a tested provider connector exists** | Do not treat TeraBox, MEGA, Degoo, MediaFire, pCloud, Box, Icedrive, Koofr, Internxt or Telegram selectors as direct-upload integrations |
| User registration / login | Supabase Auth, profile, login/logout and password reset flows | **CODE READY**; owner reports Admin login works | Signup confirmation, SMTP delivery, password reset and session-expiry E2E |
| Password policy | Eight-character minimum and selected complexity rule; application Admin password checks | **CONFIGURED BY OWNER**; successful Admin login was reported | Final signup/reset checks; do not claim leaked-password protection is enabled |
| Secure Admin entry | Separate Secure Admin entry, no public Control Center button, staff session marker and signed HttpOnly cookie | **DEPLOYED** | Verify issuance, expiry, logout, no-session rejection and staff-role access |
| Role-based Admin | Admin, sub_admin, content_editor and moderator navigation/API boundaries | **CODE READY** | Live allow/deny test for every role; only one Production profile row was listed at last inventory, so test identities are not yet available for a complete role-by-role browser test |
| Security activity | Cloudflare D1 events, guest/member/Admin activity, IP capture, temporary block and Main Admin-only logs | **D1 + Production binding + code deployed** | Verify guest, member, staff, denied and blocked records; verify Main Admin-only read and 1-hour cookie expiry |
| User profile / watchlist | Profile, saved movies and account-level watchlist | **CODE + TABLES PRESENT** | Real member account tests and cross-session persistence |
| Continue Watching | Watch progress storage and resume player | **CODE + TABLE PRESENT** | Real playback progress and resume test |
| Movie requests | Guest/member request submission, owner history and moderation | **CODE + TABLE PRESENT** | Guest and member submission, privacy and moderation tests |
| Community | Suggestions, bugs, complaints, admin response, public roadmap and one-vote-per-user rule | **TABLES + RLS + RPC DEPLOYED**; anonymous voting rejected | Member submission, owner visibility, moderation, one-vote and duplicate-vote tests |
| Donations | UPI intent, reference submission, history, manual Admin verification | **TABLE + ₹1–₹999 limit deployed** | UPI ID/QR are blank in Production; configure them before any payment test. This is not automatic bank settlement |
| Telegram | Webhook, commands, publish notification and authenticated request notification | **CODE READY, NOT CONFIGURED** | Bot token, webhook secret, admin chat ID and optional channel ID; then webhook/notification tests |
| AdSense placements | Home/footer placements and ads.txt | **CODE READY; ads_enabled is OFF** | Google approval, publisher ID, slots and any required consent-management setup |
| AdSense revenue | Server-side OAuth report endpoint | **CODE READY, NOT CONFIGURED** | OAuth client, refresh token, account ID and reporting permission; only real API values should be shown |
| Analytics / reports | Page/content/play/request/download events, popular-content RPC, admin reports | **TABLE + RPC DEPLOYED**; 963 analytics events at last inventory | Validate dashboard numbers against source records and confirm privacy boundaries |
| Categories | Admin category management and category catalogue | **CODE READY; current category table empty** | Create lawful categories and test ordering/filter use |
| Team management | Admin creation and management of staff roles | **CODE READY; Admin-only API** | Test invite/create/update/disable against separate test identities |
| Legal / privacy | Privacy, Terms and Copyright pages and footer links | **PAGES PRESENT** | Owner/legal review, correct contact/business details and applicable consent setup |
| SEO / performance | Metadata, canonical/robots/sitemap, structured data and lazy media loading | **BASELINE CODE PRESENT** | Crawl, Lighthouse, image loading, keyboard, contrast and real phone checks |
| Deployment / operations | GitHub main → Cloudflare Pages automatic Production deploy; Pages Functions and D1 binding | **DEPLOYED** | Continue monitoring deploys and run final production smoke checks |
| Backup / restore | Production database and media recovery planning | **NOT VERIFIED** | Confirm backup retention, export/restore procedure and a safe restore rehearsal |

## 3. What was fixed in this development batch

| PR | Change | Outcome |
|---:|---|---|
| #17 | Infer supported video MIME types from file extension; correct B2 default in Production | **Merged + deployed** |
| #18 | Align B2 column defaults in the standalone migration | **Merged** |
| #19 | Fix episode and song MIME fallback | **Merged + deployed** |
| #20 | Persist Original as a valid media resolution; accept it in SQL constraint | **Merged + deployed** |
| #21 | Make Episode default quality Original instead of NULL | **Merged + deployed** |
| #22 | Align feature SQL storage defaults and ₹999 donation cap | **Merged** |
| #23 | Current production status, safe RPC wrappers, policy consolidation, download analytics and FK indexes | **Merged + deployed** |
| #24 | Refresh the Production snapshot and provider setup register | **Merged + deployed** |

Earlier foundation work also includes password form minimum alignment, SQL dollar-quote repairs, Admin-session protections, RLS hardening, B2 provider support, private media APIs and the security activity D1 store.

### Movie upload root causes confirmed

1. Movie Admin saved the primary Original source as SQL NULL.
2. Production requires a video media asset to have a non-null resolution and had excluded the Original label.
3. Therefore the object could upload and then fail on the media-asset insert, with cleanup removing the uploaded object.
4. This is now corrected: the source is stored as original, the check constraint accepts original, and the player displays Original.
5. The B2 default was previously still Supabase in the live storage setting/column defaults. All three relevant defaults now use backblaze_b2.
6. Browser files with empty/generic MIME types could be rejected before the upload began. Movie, Episode and Song code now derives the supported Content-Type from the extension and uses it for signing and upload.
7. Episode publishing had an incomplete Production schema. Episode type, series relationship, season/episode metadata, parent validation and unique episode ordering are now applied.

**Important:** SQL rollback tests passed for Original Movie media, a Web Series → Episode → Original media chain and a ₹999 donation row. These tests prove database constraints, not a live browser upload.

## 4. Production facts — last verified snapshot

### Cloudflare Pages

- Project: bunnyhub
- Production alias: https://bunnyhub.pages.dev
- Cloudflare Pages currently has no custom domain attached; the pages.dev hostname is the public site address until an owner-owned custom domain is connected.
- Latest deployment: 1006b1b9
- Latest deployed commit: f936f24d84127161c8c17deeb49c29b68ab35971
- Deployment stages: Cloudflare build and deploy succeeded.
- Names of configured Production variables include Supabase URL/client/service credentials, four B2 settings and the Admin session secret. Secret values are not copied into this report.
- R2, PixelDrain, Google Drive, Telegram and AdSense OAuth variable names were absent in the last Production configuration inventory.
- VH_SECURITY_DB is the D1 security database binding; the binding name is not an environment secret.

### Supabase Production

Project ref: bmtbsguwbbeuvmvdfdyb.

| Production table | Rows at last inventory | Meaning |
|---|---:|---|
| profiles | 1 | Owner/admin profile is present; there are no listed role-test profiles |
| vh_content | 0 | No movie/series/short/documentary/episode catalogue records |
| vh_media_assets | 0 | No linked video/audio/subtitle media assets |
| vh_songs | 0 | No songs |
| vh_categories | 0 | No category records |
| vh_requests | 0 | No submitted content requests |
| vh_storage_settings | 1 | Default storage setting row exists |
| vh_site_settings | 11 | Public site settings exist |
| vh_analytics_events | 963 | Analytics event history exists |
| vh_user_watchlist | 0 | No saved watchlist rows |
| vh_watch_progress | 0 | No watch-progress rows |
| vh_donations | 0 | Donation table exists; no submissions |
| vh_feedback | 0 | Community feedback table exists; no posts |
| vh_feedback_votes | 0 | No votes |

The empty catalogue is why movie/series/song rails can show empty states even though the interface and database tables are present. No fabricated or commercial copyrighted demo catalogue was inserted.

### Storage defaults verified

- vh_storage_settings.default_provider = backblaze_b2
- vh_content.storage_provider column default = backblaze_b2
- vh_media_assets.storage_provider column default = backblaze_b2

### Advisors

- Security: the only current warning is leaked-password protection disabled on the current Supabase Free plan.
- Performance: no multiple-permissive-policy warning and no unindexed-foreign-key warning; 11 unused-index INFO notices remain. Indexes were not removed because unused does not automatically mean unnecessary.
- Health: no findings.
- Public RPCs use invoker-safe wrappers; privileged implementations are in the private schema.
- Admin security and B2 provider settings are present, but app-level upload and role E2E are still outstanding.

## 5. Role and permission matrix

This is the intended/implemented permission design. The final column is the live verification state, not an assumption that every role has already been tested.

| Role | Intended permitted actions | Must be blocked | Verification state |
|---|---|---|---|
| Guest / anonymous | Browse public/published catalogue, read public roadmap items, submit permitted guest content requests; submit a donation reference only after UPI is configured | Private/unpublished content, account data, Admin pages/APIs, feedback voting | SQL/RLS and public endpoints need negative/positive E2E |
| Registered user | Public browse, own profile, own watchlist/progress/request history, submit feedback, vote on eligible public roadmap items, donation history | Admin publishing, other users' private data, staff/Admin APIs, security/IP logs | Code/schema present; member account E2E pending |
| Moderator | Limited request moderation tab/API | Storage settings, users/team, reports, publishing and security logs | UI role filter exists; live API allow/deny test pending |
| Content Editor | Add/manage allowed catalogue content and upload media; ownership restrictions apply | Other editors' content, protected Short deletion, root-only settings/users/team/reports/security activity | Backend ownership checks exist; live allow/deny test pending |
| Sub-admin | Limited Admin content/short/request-management workflows and allowed media operations | Root-only team, users, settings, storage manager, categories, songs, reports, dashboard and login-activity controls | UI/API role restrictions exist; live allow/deny test pending |
| Admin / Main Admin | Full Control Center, staff/team, settings, storage, publishing, reports, donations review and security activity | Still subject to server validation, signed Admin session and safe input rules | Admin login has been confirmed by owner; full feature/API E2E pending |

**Secure Admin rule:** staff-protected APIs require both the correct Supabase profile role and a valid signed Admin session cookie. The cookie is HttpOnly, Secure and SameSite=Strict, with a one-hour lifetime. Five failed/denied attempts in a 30-minute window trigger a 30-minute IP block. Security activity reading is Main Admin-only. Passwords, OTPs and tokens must not be stored in the activity log.

**Routes checked in source:** media upload URL, B2 verification and media delete allow admin/sub_admin/content_editor; team management, Drive import, AdSense report, Telegram webhook setup, song deletion and security log reading are Main Admin-only; media/song read access checks published content and attached asset rows; Telegram request notification verifies request ownership. These guard declarations have been reviewed statically, but they have not yet been tested with one live account per role.

## 6. Step-by-step final verification plan

No test should be labelled PASS unless its observable acceptance condition is met. Record one result per row: PASS / FAIL (fix then rerun) / BLOCKED (exact dependency).

| Step | Test | Action | PASS condition | Data/cleanup |
|---:|---|---|---|---|
| 0 | Production baseline | Confirm Production commit, Pages settings, Supabase ref, table inventory and advisors | All target services point to the intended Production project; no secrets exposed | Read-only |
| 1 | Admin session | Owner signs in through Secure Admin using Ctrl+Shift+A | Admin role verified, secure cookie present, protected pages/API work | No credential sharing |
| 2 | B2 configuration | Check server configuration and private bucket scope/CORS | B2 is configured; exact production origin permitted; bucket stays private | No content created |
| 3 | B2 provider probe | Use the protected B2 health-check route | Temporary probe object PUT, GET/read-back and DELETE all succeed | Probe auto-deleted |
| 4 | Movie upload — Main Video Only | Select a small owner-owned/original or rights-cleared MP4 and keep quality at Original | Signed URL created; B2 PUT returns success; content and media rows saved; no cleanup error | Clearly labelled temporary test entry |
| 5 | Movie playback/download | Open the temporary published test card and play/download it | Signed read works, video plays/seeks, download uses the correct attachment | Temporary record/object deleted after approval |
| 6 | Alternate MIME | Repeat with an authorised MKV or another supported extension where browser MIME can be blank/generic | Extension-derived Content-Type matches signed PUT and object accepts it | Delete test object/rows |
| 7 | Episode | Create temporary Web Series + Episode; upload one Original source | Parent/season/episode metadata and media row save; playback resolves under series | Delete Episode first, then Series and objects |
| 8 | Short and Song | Upload a small Short and audio clip | Correct provider, metadata, signed playback and delete | Delete test rows/objects |
| 9 | Permissions | Test guest, member, moderator, content_editor, sub_admin and admin against allowed + denied operations | Correct allowed action passes; every forbidden action returns denial; no cross-user access | Dedicated test accounts or SQL rollback simulation |
| 10 | Member features | Signup/login/reset, watchlist, progress, requests, feedback and votes | Correct owner-only visibility and persistence | Test account data removed after test |
| 11 | Donations | Configure UPI/QR, submit a test reference, verify and reject workflows | ₹1–₹999 accepted; outside range rejected; only Admin can verify | Clearly marked test reference; never a real bank transfer |
| 12 | External services | Telegram webhook, Drive public import, optional R2, AdSense after approval | Each configured integration passes a real provider call | No credentials pasted into chat |
| 13 | Security / audit | Test cookie expiry, unauthorized access, lockout, Main Admin-only activity | 401/403/429 behavior and event records match the policy | Avoid intentionally locking out the owner account |
| 14 | Final QA | Desktop/mobile, browser console/network, accessibility, performance, SEO, RLS/IDOR and backup/restore | No critical errors; results recorded with evidence | Do not delete real customer data |

### Upload test sequence — the most important gate

The full application path is:

**Admin session → choose file → request signed B2 URL → browser PUT to B2 → insert content row → insert media asset row → public published-content check → signed GET → play/download → delete object and rows.**

The existing server endpoint /api/media/status only reports whether configuration variables exist; it does not prove upload works. The protected /api/media/verify-b2 endpoint performs a temporary B2 object test and cleans it up, but the Storage Manager script currently does not expose a dedicated button for it. An actual Movie upload through the current Admin form is therefore the definitive application-path test.

The test record must be temporarily published to pass the current public playback check. It may briefly appear in the catalogue. Do not use copyrighted commercial film material unless the owner has the distribution rights. Use a short original or rights-cleared video and remove the test entry and object after verification.

## 7. Owner-controlled access and permission register

The development instruction already authorises routine code review, code fixes, documentation, read-only diagnostics, non-destructive schema inspection and rollback-only SQL tests. No additional approval is needed for those.

The following actions require owner participation or explicit one-time approval:

| Owner input / permission | Why it is needed | Safe way to provide it |
|---|---|---|
| Keep the owner signed into Secure Admin in their own browser for the coordinated upload test | The signed Admin session is tied to the owner's browser; it must not be copied into chat | Owner logs in locally. Never send passwords, cookies, JWTs or OTPs |
| Approve a temporary B2 object + temporary TEST catalogue record, briefly published, then deleted | A real upload/playback test needs an actual object, metadata row and published-content read path | One small owner-owned/original or rights-cleared sample clip; confirm the temporary record may be visible briefly |
| Approve dedicated temporary test identities for member, moderator, content_editor and sub_admin | Production currently has only one listed profile, so a full live role matrix needs separate accounts | Owner creates/controls test identities through the Admin workflow; do not share their passwords |
| Test email confirmation/password reset | Requires an actual mailbox to receive Supabase email | Owner uses a test inbox and checks the message locally; only report whether it arrived |
| Configure UPI display ID and QR | These are business/payment details only the owner knows and controls | Enter directly in Admin Platform Settings; do not send UPI PIN/OTP/bank credentials |
| Configure Telegram, Google Drive, R2, PixelDrain or AdSense | These require provider-specific accounts/keys/approval | Owner adds secrets directly in Cloudflare Pages; never paste secret values in chat |
| Rights-cleared sample catalogue | Real public rails need assets with distribution permission | Owner supplies owned/licensed assets or explicitly authorises a rights-cleared sample source |

### Never request or share

Supabase service-role key, B2 application key, R2 secret, Telegram bot token, Google OAuth secret, AdSense refresh token, Supabase auth JWT, Admin cookie, passwords, OTPs or UPI PIN. These remain in the provider dashboard or the owner's own browser session.

## 8. Missing capabilities and limits — do not describe as complete

- Video upload is a single signed PUT up to 5 GB; multipart/resumable upload above 5 GB is not implemented.
- Audio upload is capped at 1 GB.
- PixelDrain in-app upload is limited to 90 MiB and its key is not configured in Production.
- R2 is optional and its Production secrets are not configured.
- Google Drive supports public-file linking/import only; private file/folder import and direct Drive-to-B2 copy are not implemented.
- TeraBox, MEGA and other listed providers remain authorised URL/link based unless their official direct connector and credentials are added and tested.
- Telegram bot secrets and target chat IDs are not configured in Production.
- AdSense is deliberately disabled until approval, publisher ID and slots exist; revenue reporting also needs OAuth.
- UPI donation submission is unavailable until the owner configures UPI ID/QR; donation status is manually checked, not auto-settled through a bank/payment gateway.
- Supabase Free plan does not currently expose the leaked-password protection toggle; no upgrade is requested.
- Live app upload/playback and live role-by-role API checks remain pending; SQL rollback tests are not substitutes.

## 9. Priority order from here

| Priority | Next work | Why first | Exit condition |
|---|---|---|---|
| **P0** | Full B2 Movie upload → DB → playback → delete E2E | Fixes the exact failure the owner reported | One real authorised file passes the complete application path and all temporary data is removed |
| **P0** | Role/permission tests | Confirms staff cannot see or modify data outside their rights | Guest/member/moderator/editor/sub-admin/admin allow/deny matrix passes |
| **P0** | Auth/email flow | Signup, confirmation and password reset are core member flows | Mail arrives and all auth/session flows pass |
| **P1** | Movie/Series/Episode/Short/Song CRUD and player tests | Proves catalogue is usable end-to-end | Each content type creates, edits, publishes, plays and deletes correctly |
| **P1** | Watchlist, progress, requests, feedback and donation tests | Completes member/community workflows | Owner privacy and moderation/payment-reference checks pass |
| **P1** | Lawful starter catalogue | Homepage is currently empty | Every homepage rail has real, authorised content |
| **P2** | Telegram and Google Drive; optional R2/PixelDrain | These depend on owner-controlled provider credentials | Each configured integration passes real provider test |
| **P2** | AdSense and consent setup | Only after Google approval and required consent setup | Valid publisher/slots/OAuth and policy compliance |
| **P3** | Desktop/mobile, accessibility, performance, SEO, backup/restore | Final launch quality gate | Evidence-based final report has no critical failure |

## 10. Current decision / next step

The next test is not a vague “please test the website”. It is one controlled, recorded upload run with a clearly marked temporary item, followed by role checks and auth tests. The owner should approve the temporary Production test object/record and keep the Secure Admin session in their own browser. All credentials stay private.

**Final completion rule:** each workstream is marked PASS, FAIL (then fixed and retested), or BLOCKED with the exact owner/provider dependency. BunnyHub is not called complete while Movie upload/playback, account permissions, critical member flows or the final device/security checks remain unverified.
