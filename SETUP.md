# BunnyHub — Hardened Deployment & Security Setup Guide

## 1. Cloudflare Pages Required Secrets & Bindings
Cloudflare Pages → **Settings → Variables and Secrets** mein yeh secrets set karein:
- `SUPABASE_URL`: `https://gspkgdpkysfzjeqevsja.supabase.co`
- `SUPABASE_ANON_KEY`: Aapka Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key (sirf server-side; browser me kabhi nahi)
- `VH_ADMIN_SESSION_SECRET`: 64-char random hex secret (Admin HttpOnly session cookie sign karne ke liye)
- `ADMIN_SECURITY_PIN`: Double-layer Admin login ke liye secret PIN/passphrase
- `ADMIN_OWNER_EMAIL` (optional): Agar `admin` username alias use karte hain toh owner email server-side yahan rakhein
- Backblaze B2: `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY`
- Optional: `TMDB_API_KEY` (server proxy `/api/tmdb/search` ke liye), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_CHANNEL_CHAT_ID`

## 2. Cloudflare D1 Database (`VH_SECURITY_DB`)
1. Cloudflare Dashboard → **Workers & Pages → D1** me `bunnyhub-security` database banayein.
2. `cloudflare/d1-security-schema.sql` ko D1 console ya `wrangler d1 execute` se apply karein.
3. `wrangler.json` me `database_id` update karein (aur Cloudflare Pages → Settings → Functions → D1 database bindings me `VH_SECURITY_DB` bind karein).

## 3. Supabase SQL Schema Fix
Supabase SQL Editor me `supabase/bunnyhub-fix-missing-schema.sql` run karein (aur agar naya DB hai toh pehle `vision-hub-master-setup.sql`, `vision-hub-feature-upgrade-bundle.sql`, aur `vision-hub-production-hardening.sql` chalayein).

## 4. Production Build Option (`dist/`)
- Default deploy (`pages_build_output_dir: "."`): `functions/_middleware.js` automatically `.sql`, `.md`, `/supabase/`, `/cloudflare/`, `/scripts/`, aur `wrangler.json` ko public HTTP access (`404`) se block kar deta hai.
- Optional clean `dist/` output: `node scripts/build-dist.mjs` run karke comments-stripped assets `dist/` me generate kar sakte hain.
