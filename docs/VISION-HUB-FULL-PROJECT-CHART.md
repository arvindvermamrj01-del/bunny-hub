# BunnyHub — सम्पूर्ण Project Chart: शुरुआत से Public Launch तक

**स्थिति snapshot:** 21 नवम्बर 2026  
**मुख्य Production URL:** https://bunnyhub.pages.dev  
**Repository:** https://github.com/bunnyhub-admin-del/bunnyhub  
**मुख्य उद्देश्य:** BunnyHub को उसके approved Cinema4U-style interface और सभी तय features के साथ पूरी तरह usable, tested और public-launch ready बनाना।

यह दस्तावेज़ केवल feature list नहीं है। इसमें शुरुआत में तय product requirements, design, GitHub, hosting, domain, database, storage, Admin data upload, user login, integrations, permissions, security, testing और final publishing—हर चरण बताया गया है।

> **स्थिति समझने का नियम:** Code मौजूद होना, credential लगा होना और वास्तविक end-to-end test पास होना तीन अलग बातें हैं। किसी feature को Verified तभी माना जाएगा जब उसका पूरा user-facing workflow सफल हो।

## 1. शुरुआत में BunnyHub का लक्ष्य क्या था?

| मूल लक्ष्य | क्या बनना था | स्थिति |
|---|---|---|
| Cinema4U-style discovery website | Movies, TV Shows/Web Series, Latest, Popular, Genres और Search वाला catalog अनुभव | मौजूदा approved interface मौजूद; नई बड़ी redesign नहीं करनी |
| अपना brand और layout | BunnyHub नाम, अपना styling, रंग, themes और responsive navigation | Implemented; final mobile QA बाकी |
| Movie details | Home page पर movie चुनने पर details popup/modal; पूरा homepage बिना वजह replace न हो | Code/layout मौजूद; final interaction QA बाकी |
| Separate player | Watch Now के बाद player खुले; details popup और player minimise/close व्यवहार अलग रहे | Code मौजूद; final real playback QA बाकी |
| Content की अपनी library | Movies, Series, Episodes, Documentaries/Shows, Shorts और Songs | Admin/data models मौजूद; Production catalog अभी खाली |
| सुरक्षित video storage | Private object storage, signed uploads और short-lived playback URLs | B2 configured/default; actual app E2E बाकी |
| Member accounts | Signup, login, email confirmation, profiles, watchlist, requests और progress | Code + tables मौजूद; real account/SMTP tests बाकी |
| Admin Control Center | Content upload/manage, categories, songs, requests, team, settings, reports और activity | Code deployed; हर role और workflow का E2E बाकी |
| Future integrations | Telegram, Google Drive, UPI donation, AdSense और optional storage providers | कई integrations का code है; external setup/approval बाकी |
| Launch quality | Desktop/mobile, security, performance, SEO, accessibility और backup review | Final sign-off बाकी |

## 2. Website पर कौन-कौन से user-facing features चाहिए थे?

### A. Homepage, browsing और discovery

| Section / feature | अपेक्षित व्यवहार | स्थिति |
|---|---|---|
| Header और navigation | Movies, TV Shows/Web Series, Genres, Shorts, Music, Community/Feedback, Search | Implemented; final responsive check |
| Homepage hero / featured area | Featured content और prominent Watch Now/Details actions | Implemented; real content से भरना बाकी |
| Trending / Popular | वास्तविक content views पर आधारित popularity | 30-day popularity RPC deployed; catalog खाली |
| Latest Entries | सबसे नए published records, created date के हिसाब से | Code मौजूद; data और sorting test बाकी |
| Movies rail | Movie cards, genre/year/language browsing | Code मौजूद; real catalog test बाकी |
| TV Shows / Web Series rail | Series cards और season/episode detail | Code + Episode schema deployed; content test बाकी |
| Shorts rail | Short-video catalog | Code मौजूद; upload/test बाकी |
| Music / Songs | Searchable public song library | Code + table मौजूद; songs अभी 0 |
| Genre discovery | Genre/category browse और filters | Code मौजूद; Production categories 0 |
| Search | Title, actor, director, genre, language, year जैसे metadata पर search | Code मौजूद; populated-data test बाकी |
| Filters / sorting | Release year, language, genre, latest, top-rated/popular sorting | Code मौजूद; real data पर regression बाकी |
| Empty states | Catalog खाली हो तो clear empty-state, broken cards नहीं | मौजूद; final browser check बाकी |

### B. Movie details और player

| Feature | अपेक्षित व्यवहार | स्थिति |
|---|---|---|
| Movie details popup | Poster, title, description, cast/director, release year, language, genre आदि | Existing UI; final interaction test बाकी |
| Watch Now | User के action पर video player खुले | Code मौजूद; real B2 file test बाकी |
| Player controls | Play/pause, seek, volume, fullscreen और playback controls | Code मौजूद; device-wise test बाकी |
| Quality selector | Original और उपलब्ध 180p–8K variants | Original database bug ठीक; actual source tests बाकी |
| Subtitles | सही WebVTT (.vtt) subtitle track | Code/metadata support; real subtitle test बाकी |
| Download | केवल वास्तविक supplied/linked file का authorized download | Code मौजूद; provider-wise test बाकी |
| Continue Watching | Playback position save हो और वापस वहीं से चले | Table/code मौजूद; real account test बाकी |
| Next Episode | Series के episode क्रम में navigation | Code मौजूद; actual series/episode test बाकी |
| Minimise / close | Details popup और player का व्यवहार स्वतंत्र रहे | Existing design; regression test बाकी |

### C. Member और Community सुविधाएँ

| Feature | क्या करना था | स्थिति |
|---|---|---|
| User Signup | Email/password registration | Code मौजूद; email delivery test बाकी |
| Email Confirmation | Supabase confirmation email और सही redirect | SMTP/E2E pending |
| User Login / Logout | सुरक्षित session बनना और समाप्त होना | Code मौजूद; real tests बाकी |
| Password Reset | Reset email और नया password set करना | Code मौजूद; SMTP/E2E बाकी |
| Profile | User profile और account details | Code मौजूद; account test बाकी |
| Watchlist | Member की अपनी saved movies | Table/code मौजूद; real test बाकी |
| Watch History / Progress | Member की playback progress | Table/code मौजूद; real test बाकी |
| Content Requests | Guest/member request submit और अपना history देखना | Code + table मौजूद; tests बाकी |
| Community Feedback | Suggestion, bug report, complaint | Tables/RLS deployed; member test बाकी |
| Voting | Authenticated user एक eligible item पर एक बार vote करे | RPC/RLS deployed; real user test बाकी |
| Donations | UPI intent, transaction reference और manual verification | ₹1–₹999 DB limit deployed; UPI ID/QR blank |

## 3. Admin Control Center में कौन-कौन से sections होने थे?

| Admin section | काम |
|---|---|
| Dashboard | Movies, Series, Shorts, Songs, users, requests, donations और analytics summary |
| Add / Manage Movies | Movie metadata, poster/artwork, primary video, alternate qualities और publish/unpublish |
| Web Series | Series record और series details |
| Seasons & Episodes | Series चुनना, season/episode number, episode title और video upload |
| Shorts Manager | Short content upload, metadata और management |
| Categories / Genres | Categories बनाना, edit करना और catalog में लागू करना |
| Music / Songs | Song metadata, audio upload, direct audio URL और delete |
| Storage Manager | Preferred provider देखना/बदलना और provider configuration status |
| Google Drive Import | Public shared individual Drive file को catalog से जोड़ना |
| Requests Admin | User/guest content requests देखना और review करना |
| Users / Team | Staff roles और team accounts; Main Admin-only operations |
| Community Feedback | Feedback moderation, status और Admin response |
| Donations | UPI references देखना और payment proof manually verify/reject करना |
| Analytics & Reports | Views, requests, downloads, usage और configured होने पर AdSense report |
| Platform Settings | Site details, UPI, ad slots, Telegram settings और public configuration |
| Secure Login Activity | Guest/member/staff/failed/blocked events; केवल Main Admin read कर सके |
| Maintenance / Public Settings | Published site settings और maintenance behavior |

**ध्यान दें:** Admin screen पर tab दिखना अकेले permission का प्रमाण नहीं है। हर server API को role और secure Admin session से अलग verify करना होगा।

## 4. Project के tools और services — कहाँ क्या काम होता है?

| Service / जगह | BunnyHub में भूमिका | वर्तमान जानकारी | बाकी |
|---|---|---|---|
| GitHub repository | पूरा source code, commits, branches, PRs और migration files | `bunnyhub-admin-del/bunnyhub`; मुख्य branch `main` | PR/commit discipline जारी रखना |
| GitHub Actions | JavaScript syntax और SQL migration structure checks | `.github/workflows/validate.yml` मौजूद | हर relevant PR/merge का CI result देखना; यह browser E2E नहीं |
| Cloudflare Pages | Website hosting और Production deployments | Project `bunnyhub`; GitHub `main` से auto deploy | हर release पर deployment success और smoke check |
| Cloudflare Pages Functions | Secure APIs, signed media URL, Admin guards और provider access | Repository के root `/functions` में | Route-wise negative/positive API tests |
| Cloudflare D1 | Security/login activity database | Database `bunnyhub-security`; binding `VH_SECURITY_DB` configured | Live guest/login/lockout/activity tests |
| Supabase Auth | Signup, login, email, password reset और sessions | Project ref `bmtbsguwbbeuvmvdfdyb`; Free plan | SMTP और member auth E2E |
| Supabase PostgreSQL | Profiles, catalog metadata, media metadata, requests, watchlist, settings, analytics | Production schema और VH tables मौजूद | Actual data और account workflow tests |
| Supabase RLS | Database row/column-level access | Policies और recent hardening deployed | Role-wise IDOR/negative tests |
| Backblaze B2 | नई video uploads का preferred private object storage | Bucket `bunnyhub-media`; endpoint `s3.us-east-005.backblazeb2.com` | Browser app upload → playback → delete E2E |
| Supabase Storage | पुराने private media objects का legacy support | Bucket `vh-private-media` private रहना चाहिए | Existing legacy object read test |
| Cloudflare R2 | Alternative object storage | Code path है; Production secret variables absent | Optional; तभी लगाना है जब owner चुने |
| PixelDrain | Optional alternate provider | Code path; Production API key absent; app upload limit 90 MiB | Optional provider setup/test |
| Google Drive API | Individual public shared file import | Code मौजूद; API key absent | API key + public file test |
| Telegram Bot API | Publish/request notifications और bot commands | Code मौजूद; secrets absent | Bot/webhook configuration और test |
| Google AdSense | Website ad placements, ads.txt और revenue report | Code मौजूद; ads अभी OFF | Google approval, publisher/slots, OAuth और consent |
| UPI | Donations | UPI ID / QR setting blank | Owner configuration और manual verification test |

## 5. Hosting और website publish करने की पूरी व्यवस्था

### A. Source code → Hosting pipeline

| क्रम | क्या होता है | कहाँ |
|---:|---|---|
| 1 | Application code और documentation बदलते हैं | GitHub repository |
| 2 | अलग feature branch में काम होता है | GitHub branch |
| 3 | Change review और preview deployment | Pull Request + Cloudflare Preview URL |
| 4 | Approved change `main` में merge | GitHub |
| 5 | Automatic deployment trigger | Cloudflare Pages |
| 6 | Build/deploy stages success verify | Cloudflare Pages → Deployments |
| 7 | Production domain पर smoke checks | `bunnyhub.pages.dev` |
| 8 | सभी launch gates PASS होने पर public launch sign-off | Master QA register |

### B. मौजूदा Cloudflare Pages settings

| Setting | Production value |
|---|---|
| Pages project | `bunnyhub` |
| GitHub source | `bunnyhub-admin-del/bunnyhub` |
| Production branch | `main` |
| Framework preset | None |
| Build command | Blank |
| Build output directory | `/` (repository root) |
| Root directory | Repository root |
| Functions directory | `/functions` |
| Preview deployments | Branch/PR previews enabled |
| Production URL | https://bunnyhub.pages.dev |
| Latest verified deployment at snapshot | `1006b1b9` |
| Latest deployed commit at snapshot | `f936f24d84127161c8c17deeb49c29b68ab35971` |
| Last checked deployment stage | Cloudflare build + deploy success |

**Custom domain की स्थिति:** Cloudflare Pages project पर custom domain list अभी खाली है। इसलिए वर्तमान public address `bunnyhub.pages.dev` है। कोई अलग branded domain अपने-आप जुड़ा हुआ नहीं है। Custom domain जोड़ना launch का optional हिस्सा है—इसके लिए owner का domain होना, Pages में Custom Domains जोड़ना और DNS verification जरूरी होगा।

Repository README के अनुसार पुराना Cloudflare Worker `online` canonical Pages site पर method-preserving redirect के लिए रखा गया है; actual application deployment `bunnyhub` Pages project से होता है।

### C. GitHub Actions क्या test करता है?

`.github/workflows/validate.yml` में:
- Node.js 22 के साथ सभी JavaScript files पर `node --check`
- Supabase SQL files में balanced `$$` delimiters
- malformed SQL delimiter pattern detection
- SQL transaction BEGIN/COMMIT count check

ये static checks हैं। ये Supabase Production migration, actual user signup, browser upload, playback, mobile viewport या provider availability का प्रमाण नहीं हैं।

## 6. Backend और Database — क्या कहाँ सेव होता है?

### A. Supabase Production

- Project ref: `bmtbsguwbbeuvmvdfdyb`
- Plan: Free
- Supabase URL का project ref Pages config और browser config से match करता है।
- Browser में publishable/anon key public होती है; service-role key केवल encrypted Cloudflare secret में रहनी चाहिए।
- Database को recreate नहीं करना है और existing rows/media delete नहीं करने हैं।

### B. मुख्य tables

| Table | किस डेटा के लिए |
|---|---|
| `profiles` | User profile और role |
| `vh_content` | Movie, Web Series, Documentary/Show, Short और Episode metadata |
| `vh_media_assets` | Content की video/audio/subtitle files, resolution, provider और object path |
| `vh_songs` | Music catalog |
| `vh_categories` | Categories / Genres |
| `vh_requests` | Content requests |
| `vh_storage_settings` | Preferred storage provider |
| `vh_site_settings` | Site, UPI, ad, public settings |
| `vh_analytics_events` | Page/content/play/request/download events |
| `vh_user_watchlist` | User-specific watchlist |
| `vh_watch_progress` | Playback resume progress |
| `vh_donations` | UPI reference submissions और manual status |
| `vh_feedback` | Community suggestions/bugs/complaints |
| `vh_feedback_votes` | Authenticated votes |

पुरानी legacy tables जैसे `movies`, `profiles`, `requests`, `watchlist` भी मौजूद हैं। Legacy content/media को हटाए बिना migration और compatibility रखनी है।

### C. Migration / SQL files

Supabase SQL Editor में SQL files versioned हैं:
- Master setup: `bunnyhub-master-setup.sql`
- Platform upgrade: `bunnyhub-platform-upgrade.sql`
- Feature upgrade: `bunnyhub-feature-upgrade-bundle.sql`
- Production hardening: `bunnyhub-production-hardening.sql`
- B2 provider: `bunnyhub-backblaze-b2-provider-upgrade.sql`
- Series/Episodes: `bunnyhub-series-episodes.sql`
- Watchlist / progress: `bunnyhub-user-watchlist.sql`, `bunnyhub-watch-progress.sql`
- Donations / Community / Analytics / Song storage की अलग migrations भी मौजूद हैं।

**वर्तमान Production में जरूरी मुख्य VH migrations लागू हैं।** इन्हें दोबारा blindly चलाना नहीं है। नई या partial installation में README-SETUP.txt का recovery order, backup और सही project ref verify करने के बाद ही उपयोग करना है।

## 7. Storage और file upload — असली data कहाँ जाता है?

### A. Preferred storage: Backblaze B2

| Setting | मौजूदा स्थिति |
|---|---|
| Bucket | `bunnyhub-media` |
| Access | Private |
| Endpoint | `https://s3.us-east-005.backblazeb2.com` |
| Encryption | SSE-B2 AES256 enabled |
| Browser CORS origin | `https://bunnyhub.pages.dev` |
| CORS methods | HEAD / GET / PUT; browser upload/read के अनुरूप |
| Pages variables | `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY` |
| Database default | `backblaze_b2` — storage settings, content और media asset columns पर verified |
| Video upload limit | 5 GB single PUT |
| Multipart upload | 5 GB से अधिक के लिए अभी implemented नहीं |

B2 application key को केवल आवश्यक bucket तक read/write access के साथ रखना है। Bucket को public नहीं करना है।

### B. Upload करने पर क्या होता है?

**Movie / Short / Episode के लिए सामान्य flow:**

1. Admin Secure Admin Panel में login करता है।
2. Add Movie / Shorts / Seasons & Episodes में metadata भरता है।
3. Primary video file चुनता है और provider B2 default रहता है।
4. Browser सुरक्षित `/api/media/upload-url` API से short-lived signed upload URL माँगता है।
5. Browser सीधे B2 पर file PUT करता है; video bytes Pages Function से होकर नहीं जाते।
6. Supabase में `vh_content` metadata row save होती है।
7. `vh_media_assets` में content relation, resolution, provider और storage path save होते हैं।
8. Content publish होने पर player signed GET URL माँगता है।
9. API पहले published content और linked media asset verify करती है, फिर short-lived signed read URL देती है।
10. Delete में API exact content↔asset relationship verify करके object delete करती है; database record cleanup भी verify करना है।

**Main Video Only:** Primary source की quality `Original` अब `original` के रूप में save होती है; उसे NULL नहीं बनाया जाता। यह failure fix Production में deploy है।

### C. अलग content प्रकारों का upload

| Content | Admin में कहाँ | Data कहाँ |
|---|---|---|
| Movie | Add Movie / Manage Movies | Metadata: `vh_content`; video metadata: `vh_media_assets`; bytes: B2 |
| Web Series | Add Movie / Web Series content type | Parent series record: `vh_content` |
| Episode | Seasons & Episodes | Child `vh_content` row + parent_series_id, season_number, episode_number + media asset |
| Short | Shorts Manager | `vh_content` + `vh_media_assets`; bytes: B2 |
| Song / Audio | Music / Songs Admin | `vh_songs` + storage metadata; bytes: B2/R2 |
| Poster / artwork / metadata | Content Admin के उपलब्ध fields | Catalog metadata और authorised artwork source |
| Direct external video link | Content Admin का authorised URL field | URL metadata; provider object नहीं बनाया जाता |
| Google Drive video | Admin → Drive Import | केवल public share link metadata; file B2 में copy नहीं होती |
| Subtitle | Media asset / subtitle metadata | WebVTT file URL/path; host CORS भी pass होना चाहिए |

Song audio upload की code limit 1 GB है। PixelDrain in-app upload 90 MiB तक है और Production key नहीं है। दूसरे listed providers को Direct Upload न मानें जब तक उनका authenticated connector वास्तव में configured और tested न हो।

### D. Data upload के लिए minimum starter catalog

Public homepage खाली न दिखे, इसलिए lawful/owner-authorised catalog target:
- कम-से-कम 2 Movies
- 1 Web Series और 1 Season में कम-से-कम 2 Episodes
- 1 Documentary / Show
- 2 Shorts
- 2 Songs
- Posters/artwork, description, language, genre, year और real availability
- कम-से-कम 1 unpublished draft, ताकि public/private visibility test हो

इनमें commercial films, pirated links या बिना अधिकार वाले media का उपयोग नहीं करना है। Test upload के लिए छोटी original/rights-cleared file उपयोग करनी है।

## 8. Authentication, Admin access और user permissions

### A. User signup/login का पूरा flow

| चरण | क्या test करना है | Pass कब माना जाएगा |
|---|---|---|
| Signup | नया email/password | Supabase user और सही profile बनें |
| Email confirmation | Inbox में confirmation email | Email arrives, link सही site पर वापस लाए और account confirm हो |
| Login | Confirmed user sign-in | Session बने और सही member UI दिखे |
| Logout | Account से logout | Session खत्म हो और private pages बंद हों |
| Password reset | Reset email, link और नया password | Email arrives और नया password स्वीकार हो |
| Profile | Profile details load/update | केवल उसी member का data दिखे |
| Watchlist | Movie save/remove | Refresh/session के बाद सही data रहे |
| Continue Watching | Video progress save/resume | सही position दोबारा खुले |
| Requests | Guest और signed-in request submit | सही privacy और owner history |
| Community | Feedback submit/vote | Authenticated user एक बार vote कर सके |
| Session expiry | Expired session से protected action | दुबारा sign in माँगे |

Supabase में minimum password length 8 और combined complexity setting owner ने configure की थी। Admin password login owner ने सफल बताया है। SMTP email delivery की final verification बाकी है। Supabase Free पर leaked-password protection warning मौजूद है; इसे enabled घोषित नहीं करना है।

### B. Secure Admin Login

- Secure Admin entry अलग है; shortcut: Ctrl+Shift+A।
- Staff-protected API पर Supabase role के साथ valid signed Admin cookie भी चाहिए।
- Cookie: HttpOnly, Secure, SameSite=Strict; code में one-hour lifetime।
- Security D1 binding: `VH_SECURITY_DB`।
- Signing secret: `VH_ADMIN_SESSION_SECRET`।
- पांच failed/denied attempts का rolling 30-minute window और 30-minute block code में है।
- Security activity read API Main Admin-only है।
- Password/OTP/token/IP logs को सार्वजनिक नहीं करना है।

### C. Role permissions का live matrix

| Role | अनुमति | क्या deny होना चाहिए |
|---|---|---|
| Guest | Public catalog; permitted guest request | Private content, member/Admin data और Admin APIs |
| Member | अपना profile, watchlist, progress, requests, feedback/vote | दूसरों का private data, content publishing और Admin controls |
| Moderator | सीमित request moderation | Storage, Users/Team, publishing, reports और security log |
| Content Editor | अनुमति वाला content upload/manage; ownership limits | दूसरे editor का content, protected Short delete और root-only settings |
| Sub-admin | सीमित publishing, Shorts और requests | Main Admin-only Users/Team, Storage, Settings, Reports और Activity |
| Main Admin | पूरा Control Center, team, settings, storage, reports, moderation और security | हर action फिर भी server-side guard के अधीन |

Production में आखिरी inventory में केवल 1 profile row था। इसलिए अलग member/moderator/editor/sub-admin account से live role tests अभी बाकी हैं।

## 9. Cloudflare Pages में कौन-कौन से secrets/settings चाहिए?

**केवल नाम सूचीबद्ध हैं—secret values को report, GitHub या chat में कभी नहीं लिखना है।**

| Environment group | Variable names | स्थिति |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Production में मौजूद |
| B2 | `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY` | Production में मौजूद |
| Admin session | `VH_ADMIN_SESSION_SECRET` | Production में मौजूद |
| D1 | `VH_SECURITY_DB` binding | Configured |
| R2 optional | `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Production में absent |
| PixelDrain | `PIXELDRAIN_API_KEY` | Absent |
| Google Drive | `GOOGLE_DRIVE_API_KEY` | Absent |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, optional channel settings | Absent |
| AdSense reports | `ADSENSE_CLIENT_ID`, `ADSENSE_CLIENT_SECRET`, `ADSENSE_REFRESH_TOKEN`, `ADSENSE_ACCOUNT_ID` | Absent |
| AdSense publisher/slots | Publisher ID + home/footer slot IDs in Platform Settings | Not configured |

Production variables में Supabase, B2 और Admin session essentials मौजूद हैं। Optional integrations को बिना credentials के Connected नहीं दिखाना है।

## 10. Donations, monetization, Telegram और legal

| Area | अभी क्या है | Public Launch से पहले |
|---|---|---|
| UPI Donations | UPI intent, reference capture, pending/verified/rejected status; DB ₹1–₹999 | Owner UPI ID, display name, optional HTTPS QR set करे; manually verify test |
| AdSense | Home/footer placements, ads.txt और revenue report code | Approval, Publisher ID, slots, OAuth और relevant consent setup; अभी `ads_enabled=false` |
| Telegram | Bot webhook, publish/request notifications, commands का code | BotFather token, webhook secret, chat IDs और webhook verification |
| Google Drive | Single public shared video import | Drive API enable, restricted API key और Anyone-with-link Viewer file test |
| Privacy / Terms / Copyright | Pages और footer links मौजूद | Owner actual business, contact, rights, privacy/legal data review करे |
| SEO | robots.txt, sitemap.xml, page metadata, headers baseline | Crawl, canonical/structured data, broken links और search indexing review |
| Appearance | HyperOS Aurora, ColorOS Ocean, AMOLED Black और Light Glass themes | Desktop/mobile theme switching और contrast/accessibility check |

Donation flow automatic bank/payment gateway settlement नहीं है। Admin manually UTR/reference verify करेगा। AdSense approval से पहले ads बंद रहने चाहिए।

## 11. Current Production status — 21 Nov 2026

| क्षेत्र | अभी की verified स्थिति |
|---|---|
| GitHub main | Commit `f936f24d84127161c8c17deeb49c29b68ab35971` |
| Latest Production deployment | `1006b1b9`; Cloudflare build/deploy success |
| Public Pages URL | https://bunnyhub.pages.dev |
| Custom domain | कोई custom domain अभी Pages project से attached नहीं |
| Supabase project | `bmtbsguwbbeuvmvdfdyb` |
| Supabase plan | Free |
| B2 default | तीनों settings/column defaults पर `backblaze_b2` verified |
| Content rows | 0 |
| Media asset rows | 0 |
| Songs / categories / requests | 0 |
| Donations / feedback / votes | 0 |
| Profiles | 1 |
| Site settings | 11 |
| Analytics events | 963 at last count |
| Security Advisor | केवल Free-plan leaked-password-protection warning |
| Performance Advisor | Multiple permissive policy और unindexed-FK warnings 0; unused-index INFO notices बाकी |
| Health Advisor | कोई finding नहीं |
| Actual Admin app upload/playback | अभी E2E प्रमाणित नहीं |

Public Pages URL पहले से Internet पर खुलती है। लेकिन **website का technical deployment होना और पूरा public launch sign-off मिलना अलग बातें हैं**। अभी catalog खाली है और real signup/upload/member journeys पूरी तरह test नहीं हुई हैं।

## 12. शुरुआत से लेकर अब तक के प्रमुख delivery milestones

| चरण | क्या पूरा किया गया | स्थिति |
|---|---|---|
| Product/reference direction | Cinema4U-style feature parity और original BunnyHub identity | Approved scope preserved |
| Frontend foundation | Homepage, navigation, detail UI, player, themes, mobile UI | Code present; final device QA बाकी |
| Supabase foundation | Auth, Postgres, profiles, content metadata और RLS | Production connected |
| Cloudflare hosting | Pages project, GitHub main, previews और auto deploy | Active |
| B2 setup | Private bucket, app key, CORS और server variables | Configured; app E2E बाकी |
| Admin security | Secure Admin, signed session, D1 activity | Deployed; live verification बाकी |
| Data schema | Content, media, episodes, audio, requests, community, donations, analytics tables | Applied |
| Upload bug fixes | Original resolution, MIME fallback और B2 default | PR #17–#22 merged/deployed |
| RPC/RLS hardening | Invoker wrappers, policy consolidation, indexes और download analytics | PR #23 merged/deployed |
| Current status docs | Live state and blockers documented | PR #24 merged/deployed |
| Full portfolio | Feature + setup + permissions + launch chart | PR #25 merged/deployed |
| Full start-to-launch project map | Hosting, domain, all services, data upload, permissions and launch gates | PR #26 in documentation release |
| Final production sign-off | Real upload, member and permission E2E | Pending |

## 13. अब आगे की Step-by-Step Testing — PASS / FAIL / BLOCKED register

इस क्रम को नहीं छोड़ना है। Failure मिले तो पहले fix और retest, फिर अगला step।

| Step | Test | कौन करेगा | Pass condition | Current status |
|---:|---|---|---|---|
| 0 | Hosting/repository/Supabase/B2 baseline | Development | Correct projects, branches, URL and server config verified | **PASS — checked** |
| 1 | Secure Admin local session | Owner logs in locally; development checks APIs | Main Admin session valid; protected API access works | **Owner session required** |
| 2 | B2 provider probe | Development via protected API; owner session required | Temporary PUT → GET/read-back → DELETE all succeed | Provider config exists; current app check pending |
| 3 | Small Movie upload, Original only | Owner selects own/rights-cleared file in Admin | Signed PUT succeeds and both content/media rows save | **PENDING** |
| 4 | Movie playback and download | Owner opens temporary TEST title | Signed GET, play, seek and download all pass | **PENDING** |
| 5 | Movie cleanup | Development verifies result; owner approves public test cleanup | Object + media/content records gone; no orphan | **PENDING** |
| 6 | MKV / MIME fallback | Owner selects a supported file type | Browser MIME fallback and B2 Content-Type both match | **PENDING** |
| 7 | Web Series + Episode | Owner/Admin local session | Parent, season, episode, Original media and playback pass | **PENDING** |
| 8 | Short upload | Owner/Admin local session | Upload, publish, play and delete pass | **PENDING** |
| 9 | Song/audio upload | Owner/Admin local session | Audio metadata, B2 object, playback and delete pass | **PENDING** |
| 10 | Signup + email confirmation | Owner test inbox | Email arrives, link confirms account, login works | **PENDING** |
| 11 | Login/logout/password reset | Owner test account/inbox | All session and reset flows pass | **PENDING** |
| 12 | Profile/watchlist/progress/requests | Member test account | Own data persists; another user cannot access it | **PENDING** |
| 13 | Guest/member/community vote | Guest + member accounts | Public read safe; vote requires signed-in identity and one vote only | **PENDING** |
| 14 | Staff role matrix | Owner-controlled test identities | Allowed API works; denied API returns correct 401/403 | **PENDING** |
| 15 | Admin security activity | Main Admin session | Guest/login/denied/blocked events recorded; only Main Admin can read | **PENDING** |
| 16 | Donations | Owner configures UPI/QR; use dummy reference only | ₹1–₹999 validation and manual status actions pass | **BLOCKED — UPI settings blank** |
| 17 | Telegram / Drive / optional providers | Owner adds needed provider credentials directly | Each selected integration passes a real provider test | **BLOCKED — credentials absent** |
| 18 | Lawful starter catalogue | Owner supplies/approves assets; Admin loads metadata | Homepage rails populated with authorized content | **PENDING — content absent** |
| 19 | Desktop/mobile/accessibility/SEO/performance | Development + owner visual review | No critical layout, console, accessibility or mobile issues | **PENDING** |
| 20 | Backup/restore rehearsal | Owner + development | Verified database export/restore and media recovery plan | **PENDING** |
| 21 | Release candidate / launch review | Development | All P0/P1 tests pass; P2 integrations either pass or remain intentionally disabled | **FINAL GATE** |
| 22 | Public Launch sign-off | Owner confirms content/legal/domain choices | Production smoke tests pass; public catalog and account flows usable | **LAST STEP** |

## 14. Real Movie upload test — detailed procedure

### Before the upload
- Owner opens https://bunnyhub.pages.dev.
- Ctrl+Shift+A से Secure Admin login करता है।
- छोटी original/rights-cleared MP4 (और बाद में MKV) file अपने कंप्यूटर से चुनने के लिए तैयार रखता है।
- Test title को स्पष्ट `TEST — DO NOT KEEP` label दिया जाएगा।
- Temporary title published होने पर थोड़ी देर public rail में दिख सकता है, क्योंकि current playback API published content ही स्वीकार करती है।

### Test observations
- Browser में upload action और API response।
- Signed URL generation और B2 PUT status।
- Supabase `vh_content` row।
- Supabase `vh_media_assets` row।
- B2 object existence / read-back।
- Player playback, seek और signed download।
- Delete API result।
- अंतिम database counts और orphan-object check।

### Cleanup
Test object, media row और content row हटाए जाएँगे। कोई test item या object स्थायी रूप से नहीं रहना चाहिए। यह परीक्षण commercial movie या copyrighted content से नहीं करना है।

## 15. कौन-सी अनुमति किस काम के लिए जरूरी है?

| Owner action / permission | क्यों जरूरी है | सुरक्षित तरीका |
|---|---|---|
| Secure Admin में अपने browser से login | Signed session browser में रहता है; development tools को cookie/token देने की जरूरत नहीं | Owner स्वयं login करे |
| छोटी test video चुनना | वास्तविक browser file upload के लिए local file जरूरी | Original या rights-cleared file; password/share link नहीं |
| Temporary public TEST item की अनुमति | Public playback API published record मांगती है | केवल test के लिए publish, फिर पूरा cleanup |
| Temporary test role identities | अलग-अलग user roles की live permissions test करनी हैं | Owner-controlled test emails; credentials साझा नहीं |
| Test inbox | Confirmation/reset email arrival जाँचना | Owner locally inbox check करे |
| UPI settings | Donation workflow owner के payment address पर निर्भर है | Admin Platform Settings में स्वयं configure करें |
| Optional service credentials | Telegram/Drive/R2/AdSense external accounts | सीधे Cloudflare Pages encrypted secrets में डालें |
| Custom domain (optional) | Branded domain attach करना हो तो domain ownership और DNS access | Domain registrar/Cloudflare Dashboard owner control में |

**कभी भी chat में ये चीजें न भेजें:** password, OTP, Supabase service-role key, B2 application key, R2 secret, Telegram token, Google OAuth secret, AdSense refresh token, JWT या Admin cookie।

## 16. आखिरी चरण: वेबसाइट कब पूरी तरह publish मानी जाएगी?

अभी Pages URL public है, इसलिए technical hosting/deployment पहले से चालू है। लेकिन launch-ready घोषित करने के लिए यह final sequence पूरा करना होगा:

1. B2 Movie + metadata + signed playback + delete PASS।
2. Episode, Short और Song upload/playback PASS।
3. Signup, confirmation email, login, logout और reset PASS।
4. Member features और सभी role allow/deny tests PASS।
5. Homepage में real, authorised content और working catalog rails।
6. Legal/privacy text और public settings owner review।
7. Desktop + mobile + accessibility + SEO + performance + security final review।
8. Database/media backup and restore plan recorded।
9. Release candidate commit `main` पर merge; Cloudflare Production build/deploy success।
10. Production smoke test: home, details popup, Watch Now, signup/login, content pages, Admin denial/allow rules।
11. Owner final sign-off। Custom domain चाहिए तो Pages में DNS verify करके attach करें; नहीं तो Pages URL ही public address रहेगा।

**इन steps के बाद BunnyHub को “Public Launch — PASS” घोषित किया जाएगा।** यदि कोई optional integration (जैसे AdSense/Telegram/R2) configure नहीं है लेकिन उसका feature सही ढंग से disabled/labelled है, तो उसे blocker नहीं बल्कि “Optional — Not enabled” दर्ज करेंगे। पर Movie upload, account signup/login, permissions, playback, critical mobile behavior या security में कोई failure हो तो Launch PASS नहीं होगा।

## 17. Post-launch maintenance

| Routine | क्या करना है |
|---|---|
| Deployment | हर main merge के बाद build/deploy stages verify |
| Storage | B2 usage, upload failures, signed access और orphan objects monitor |
| Database | Backups, RLS advisors, schema changes और query health review |
| Security | Admin activity, failed logins, roles और secret rotation review |
| Content | Only rights-cleared uploads, metadata, working links और takedown response |
| Member support | Signup/reset/request/feedback issue review |
| SEO / Analytics | Search indexing, page traffic और genuine content views |
| Recovery | Restore drill और provider outage plan |

---

## Project completion rule

हर item को **PASS**, **FAIL — fix and retest**, या **BLOCKED — exact owner/provider dependency** में दर्ज करना है। “Code deployed”, “variable configured” या “database row exists” को live workflow success नहीं माना जाएगा।

**अंतिम लक्ष्य:** approved layout को सुरक्षित रखते हुए BunnyHub को वास्तविक content, working uploads/playback, working signup/login, proper role permissions और documented launch test evidence के साथ public users के लिए तैयार करना।
