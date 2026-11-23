# BunnyHub — Phase 2 configuration

These changes are committed to the `main` branch. Cloudflare Pages is configured for automatic deployments, so wait for the matching Production deployment to finish before expecting the new controls on the live site.

## 1. One-time Supabase migration

In Supabase Dashboard → SQL Editor, open and run:

`supabase/bunnyhub-feature-upgrade-bundle.sql`

This single transaction adds:
- Backblaze B2 and direct URL provider support to storage constraints
- Media resolution constraint alignment for 480p through 8K upload/player options
- UPI donation confirmations and admin verification
- Series season/episode metadata
- Community feedback, public roadmap and authenticated voting
- Public popular-content ranking from real first-party detail-view events

Do not paste any provider secrets into SQL or chat. Existing catalog and media rows are preserved.

## 2. Backblaze B2

Keep the existing Cloudflare Pages production variables:
- `B2_ENDPOINT`
- `B2_BUCKET_NAME`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`

The new migration allows B2 in the database constraints. After the migration, the Storage Manager can save B2 as the default. Existing Supabase and R2 support remains.

## 3. Google Drive Import

For link-based imports, enable the Google Drive API in Google Cloud and add `GOOGLE_DRIVE_API_KEY` as a Cloudflare Pages secret. Restrict the key to the Drive API. The selected file must be shared as **Anyone with the link · Viewer**. The connector verifies the public video metadata and adds a catalog record; it does not copy the original file into B2. Private files and folders are not supported by this link-based import.

## 4. Telegram bot

Create a bot with BotFather, then add these as Cloudflare Pages production secrets:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (1–256 characters; use letters, numbers, underscore or hyphen)
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_CHANNEL_CHAT_ID` (optional; the bot must be an administrator in that channel)
- `TELEGRAM_CHANNEL_URL` (optional public channel link)

Deploy the site, sign in as the main admin, open Admin → Platform Settings and select **Connect / Refresh Bot Webhook**.

Commands: `/start`, `/help`, `/latest`, `/request`, `/channel`; `/status` is admin-chat only. Authenticated user requests can notify the admin chat. Published titles and episodes can be announced to the configured channel.

## 5. Donations

In Admin → Platform Settings configure:
- Public UPI ID / VPA
- Display name
- HTTPS QR image URL (optional)

The public Support BunnyHub panel creates a UPI payment intent and lets a donor submit the UTR/reference. Every submission remains **pending** until an admin checks the bank/payment statement and verifies it. This is not automatic bank verification or a payment gateway.

## 6. AdSense

Enable ads only after Google approves the site and its content/policies:
- Publisher ID: `ca-pub-...` (save it in Admin → Platform Settings; `ADSENSE_PUBLISHER_ID` in Cloudflare Pages is the fallback)
- Homepage and footer ad slot IDs from AdSense
- The `/ads.txt` route reads the saved publisher ID securely, then falls back to the Cloudflare variable if needed.

For live earnings over 7 days, 30 days, this month or last month in Admin → Analytics & Reports, configure these Cloudflare Pages secrets:
- `ADSENSE_CLIENT_ID`
- `ADSENSE_CLIENT_SECRET`
- `ADSENSE_REFRESH_TOKEN` with the read-only AdSense OAuth scope
- `ADSENSE_ACCOUNT_ID` in the format `accounts/pub-1234567890123456`

The report panel reads actual AdSense API results; it does not invent revenue or track ad clicks.

Before serving personalised ads to visitors in the EEA, UK or Switzerland, configure a Google-certified CMP integrated with IAB TCF. Google documents this requirement here: https://support.google.com/adsense/answer/13554116. Do not enable personalised ads in those regions until the CMP is configured.

## 7. Seasons and episodes

After the SQL migration and deployment:
1. Open Admin → Seasons & Episodes.
2. Select a published Web Series.
3. Set season and episode numbers, title and video.
4. Upload to B2/R2/Supabase or provide an authorised direct URL.
5. Open that series on the public site to see its season/episode list.

Episodes reuse the existing private-media access, quality player, watch-progress and deletion pipeline.

## 8. Community

Users sign in to submit a suggestion, bug report or complaint. Admin reviews it in Admin → Community Feedback. Only planned, in-progress and completed items appear on the public roadmap; authenticated users can vote once per item.
