BunnyHub — START-TO-LAUNCH PROJECT CHART
-----------------------------------------
See docs/bunnyhub-FULL-PROJECT-CHART.md for the complete start-to-launch
project map: original feature scope, GitHub/Cloudflare hosting, domain, Supabase,
B2 data uploads, Admin/user features, role permissions, integrations and every
final QA and publication gate.

CURRENT PRODUCTION STATUS
-------------------------
See docs/bunnyhub-CURRENT-STATUS.md for the latest verified deployment, database state, movie/episode/audio upload fixes, completed checks and remaining blockers. That document supersedes older status snapshots in the docs folder.

BunnyHub — DEPLOYMENT & INTEGRATION GUIDE
===============================================

ARCHITECTURE
------------
BunnyHub is a static frontend served by Cloudflare Pages.
Supabase provides authentication, PostgreSQL, Row Level Security and metadata.
Backblaze B2 is the preferred private media store for new video uploads.
Cloudflare R2 and legacy private Supabase Storage remain supported.
Cloudflare Pages Functions hold provider secrets and expose protected APIs.
The legacy Cloudflare Worker named "online" is a method-preserving redirect to
the canonical Pages site; application code and production deployments belong
to the "bunnyhub" Pages project connected to GitHub main.

Publish only media, music, trailers and artwork that you own or are authorised
to distribute.

CLOUDFLARE PAGES DEPLOYMENT
---------------------------
1. Connect this repository to the Cloudflare Pages project.
2. Framework preset: None.
3. Build command: leave blank.
4. Build output directory: / (repository root).
5. Keep /functions at the repository root; Pages deploys these as routes.
6. Deploy main. GitHub commits trigger Pages deployments when auto-deploy is on.

SUPABASE SERVER VARIABLES
-------------------------
In Cloudflare Pages > Settings > Variables and Secrets, configure encrypted
server-side values:

  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY

The browser publishable/anon key in js/supabase-config.js is public by design.
NEVER place the service-role key in JavaScript, HTML, GitHub or chat. It bypasses
RLS and must remain a Cloudflare server secret.

Enable Supabase Email Auth, set the production Site URL and password-reset
redirect URL, configure SMTP for reliable production email, and keep the owner
account's profiles.role equal to admin.

DATABASE MIGRATIONS
-------------------
Do not recreate the production database or overwrite existing catalog rows.
For an existing installation, run the additive feature bundle in Supabase
Dashboard > SQL Editor:

  supabase/bunnyhub-feature-upgrade-bundle.sql

This bundle includes:
- Backblaze B2 as a recognised storage provider and preferred default.
- UPI donation confirmation records and admin verification policies.
- Web Series seasons and episodes.
- Community suggestions, bug reports, complaints and one-vote-per-user voting.
- Download-link click analytics.
- Private B2/R2 song-audio upload and signed playback/deletion.
- Privacy-safe 30-day popular-content aggregation.
- Content-editor ownership enforcement for catalog records, media assets and
  private Supabase Storage objects. Admins and sub-admins retain full access.
- Guest request identity protection and anonymous column-level privacy grants
  for the public catalog, songs and community board.

If the feature bundle was already applied before the security-hardening
updates, run these additive migrations once for the existing database:

  supabase/bunnyhub-content-editor-ownership-security.sql
  supabase/bunnyhub-request-submission-security.sql
  supabase/bunnyhub-public-column-access-security.sql

They tighten catalog ownership, guest-request identity, anonymous column
access and private-object permissions without deleting catalog records, media
files or existing requests. Do not rerun the old setup scripts.

If applying individual migrations instead, use the relevant files:
  supabase/bunnyhub-backblaze-b2-provider-upgrade.sql
  supabase/bunnyhub-donations.sql
  supabase/bunnyhub-series-episodes.sql
  supabase/bunnyhub-community-feedback.sql
  supabase/bunnyhub-analytics-download-clicks.sql
  supabase/bunnyhub-popular-content.sql
  supabase/bunnyhub-song-storage.sql

Initial setup only (if the database has not already been created):
  supabase/bunnyhub-master-setup.sql

PARTIAL / LEGACY DATABASE RECOVERY
----------------------------------
If the database already has legacy tables such as movies, profiles, requests
and watchlist, but has no public tables whose names begin with vh_, do not run
the feature bundle first. Use this order after taking a database backup:

1. Confirm the Supabase project in the Dashboard matches the production URL in
   js/supabase-config.js and the Cloudflare Pages SUPABASE_URL. The current
   production configuration in this repository points to project ref
   bmtbsguwbbeuvmvdfdyb.
2. Before running bunnyhub-master-setup.sql, verify that the owner UUID
   hard-coded near the end of that file exists in auth.users and belongs to
   the site owner. If it does not, stop and replace it with the verified owner
   UUID before running the script. The setup deliberately aborts rather than
   silently promoting a missing or unverified account.
3. Run supabase/bunnyhub-master-setup.sql. It is additive, reuses the
   existing profiles table and keeps legacy movies/requests/watchlist tables.
4. Run supabase/bunnyhub-platform-upgrade.sql to add staff roles, private
   media metadata and the private Supabase bucket.
5. Run supabase/bunnyhub-feature-upgrade-bundle.sql for episodes, B2,
   donations, community voting, analytics, audio metadata and data-access
   hardening.
6. Run the user watchlist, watch progress and request workflow migrations only
   if those tables/columns are not already present:
   bunnyhub-user-watchlist.sql
   bunnyhub-watch-progress.sql
   bunnyhub-request-workflow-upgrade.sql

Do not run the legacy content-setup.sql or security-and-storage-fix.sql on top
of this recovery sequence. The latter is retained for historical installations;
the current B2/R2 provider allow-list is in the feature upgrade bundle.

Previously applied account/request upgrades should not need to be repeated:
  supabase/bunnyhub-request-workflow-upgrade.sql
  supabase/bunnyhub-user-watchlist.sql
  supabase/bunnyhub-watch-progress.sql
  supabase/bunnyhub-platform-upgrade.sql

For the current combined legacy + VH production schema, run
supabase/bunnyhub-production-hardening.sql after the feature bundle. It
consolidates overlapping RLS policies without changing their effective
permissions, adds missing foreign-key indexes, restricts direct execution of
trigger handlers, hardens popular-content and community-voting RPC entry
points, and enables download-click analytics. It does not move or delete
catalog rows or media objects.

The B2 provider migration and feature bundle set Backblaze B2 as the preferred
default for new storage, content and media records. The donation migrations
cap submissions at ₹999, matching the public form. AdSense remains disabled
until a valid publisher ID and approved ad slots are configured.

After the migration, open Admin > Storage Manager to confirm the Backblaze B2
connection status. New content defaults to B2; existing legacy Supabase and R2
objects keep their original provider and remain supported.

BACKBLAZE B2 — PREFERRED VIDEO STORAGE
--------------------------------------
Create a private B2 bucket and an application key restricted to that bucket
with read/write access. Configure these encrypted Cloudflare Pages variables:

  B2_ENDPOINT
  B2_BUCKET_NAME
  B2_KEY_ID
  B2_APPLICATION_KEY

Set the bucket CORS rule for the exact production Pages origin, for example:
  https://bunnyhub.pages.dev

Allow the S3-compatible API methods used by the browser (PUT and GET; HEAD and
DELETE may also be included) and the Content-Type request header. Do not use a
wildcard origin in production.

The browser uploads directly to B2 using short-lived signed single-PUT URLs;
video bytes do not pass through the Pages Function. Current single-file upload
limit is 5 GB. Multipart/resumable upload above 5 GB is not implemented.
Playback URLs are short-lived and issued only after the server verifies that
the file belongs to published catalog content. Delete operations verify the
asset-to-content relationship before removing the object.

CLOUDFLARE R2 — OPTIONAL ALTERNATE STORAGE
------------------------------------------
R2 remains supported. Configure encrypted Pages variables:

  R2_ACCOUNT_ID
  R2_BUCKET_NAME
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY

Configure R2 CORS for the exact Pages origin and the required methods/headers.
Do not remove R2 credentials if existing content still uses R2.

SUPABASE STORAGE
---------------
Supabase remains the database/auth provider and supports legacy private media.
The vh-private-media bucket must remain private. Do not make it public to solve
signed playback errors.

GOOGLE DRIVE PUBLIC-SHARE IMPORT
--------------------------------
The Admin > Drive Import workflow can verify and add an individual public
Google Drive video file to the catalog. It does not copy the original into B2.
The file must be shared as "Anyone with the link — Viewer".

1. Enable Google Drive API in Google Cloud.
2. Create an API key restricted to the Google Drive API.
3. Add the key as an encrypted Cloudflare Pages secret:

  GOOGLE_DRIVE_API_KEY

Folder import, private Drive files and server-side Drive-to-B2 copying are not
implemented. The Drive preview uses Google's embedded player; browser download
and playback behavior remains subject to Google's sharing and file policies.

TELEGRAM BOT
-------------
Configure encrypted Cloudflare Pages secrets:

  TELEGRAM_BOT_TOKEN
  TELEGRAM_WEBHOOK_SECRET
  TELEGRAM_ADMIN_CHAT_ID
  TELEGRAM_CHANNEL_CHAT_ID
  TELEGRAM_CHANNEL_URL

Add the bot as an administrator of the target Telegram channel if it must post
announcements. In Admin > Platform Settings, use "Connect / Refresh Bot
Webhook" after the secrets are configured.

Commands: /start, /help, /latest, /search title, /genres, /request, /channel.
The /status command is restricted to TELEGRAM_ADMIN_CHAT_ID.
Published-content and authenticated-user request notifications are supported.
Bot-driven file uploads are not connected.

GOOGLE ADSENSE / REVENUE
------------------------
Ad placements are disabled by default. In Admin > Platform Settings, enter the
AdSense Publisher ID (ca-pub-...), numeric ad slot IDs and enable ads only after
Google approves the site. The /ads.txt route reads the publisher ID saved there.

For the AdSense earnings report, enable the AdSense Management API in Google
Cloud and configure these encrypted Cloudflare Pages secrets:

  ADSENSE_CLIENT_ID
  ADSENSE_CLIENT_SECRET
  ADSENSE_REFRESH_TOKEN
  ADSENSE_ACCOUNT_ID   (format: accounts/pub-...)

The report reads estimated earnings, page views, RPM, clicks and impressions.
Google account approval, policy compliance and reporting permissions remain
external requirements. Never click your own ads or encourage invalid clicks.

DONATIONS
---------
In Admin > Platform Settings, configure the public UPI ID, display name and an
HTTPS QR image URL. Users can submit their UPI transaction reference. All
submissions remain pending until an administrator checks the payment record
and marks it verified or rejected. This is manual UPI verification, not an
automatic payment-gateway settlement. No UPI PIN, OTP or bank password is ever
required by BunnyHub.

THEMES, CATALOG AND COMMUNITY
-----------------------------
The appearance selector offers HyperOS Aurora, ColorOS Ocean, AMOLED Black
and Light Glass. Preferences are saved on the visitor's device.
The catalog includes search across title/actor/director/genre/language/year,
release-year and language filters, sorting, latest entries, top-rated content,
popular genres, Web Series seasons/episodes, watchlist, continue watching,
shorts, trailers, subtitles, actual supplied download links and a searchable public music library with private B2/R2 audio uploads (up to 1 GB per audio file) or direct HTTPS audio URLs.
The homepage popular rail uses aggregated content-detail views from the last
30 days; raw session tags remain admin-only.
Community feedback supports suggestions, bug reports, complaints, admin
moderation and authenticated voting.

OTHER STORAGE PROVIDERS
-----------------------
Backblaze B2, Cloudflare R2 and legacy Supabase Storage support direct uploads.
Google Drive supports public-share catalog linking as described above.
TeraBox, MEGA, Degoo, MediaFire, pCloud, Box, Icedrive, Koofr, Internxt and
Telegram are not all direct-upload integrations. Where no verified connector
is configured, use an authorised external share URL. Selecting a provider in
the UI does not create or authenticate a provider account.

LEGAL AND ADVERTISING DISCLOSURES
---------------------------------
Public policy pages are available at /privacy.html, /terms.html and /copyright.html.
The privacy page discloses account and analytics data, service providers, local
storage and Google advertising cookies. The footer links directly to these pages.
The site owner should review the text for the actual business, jurisdiction and
data practices before monetisation. If serving personalised ads to visitors in
the EEA, UK or Switzerland, configure a Google-certified IAB TCF CMP as required
by Google's current consent rules.

SECURITY NOTES
--------------
- Never paste or commit service-role keys, B2/R2 secrets, provider passwords,
  OAuth secrets, UPI PINs or OTPs into repository files or chat.
- Keep server secrets in Cloudflare Pages encrypted variables.
- Give staff least privilege: sub_admin, content_editor or moderator.
- Keep media buckets private and use signed URLs for published assets.
- Only publish media you own or are licensed to distribute.
- Use HTTPS media URLs. Subtitle tracks must be WebVTT (.vtt) files and their
  host must permit browser cross-origin requests.
- localStorage is a guest/device convenience, not a secure account database.
- Baseline browser security headers are defined in /_headers.

FINAL VERIFICATION
------------------
Run the full end-to-end, functional, mobile, performance and security pass only
after the database migrations, Cloudflare secrets, B2 CORS, optional provider
credentials and production deployment are configured. Verify sign-up/sign-in,
password reset, profile, roles, content create/edit/delete, Drive public-share
import, B2/R2/Supabase upload and playback, download links, subtitles, episode
management, requests, watchlist/progress, community voting, donations, AdSense,
Telegram bot/webhook, responsive themes, SEO and security policies.
