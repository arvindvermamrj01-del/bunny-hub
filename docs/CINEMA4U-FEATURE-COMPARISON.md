# Cinema4U reference comparison — BunnyHub

This comparison uses the Cinema4U-style navigation and discovery categories reviewed for this project. The goal is feature parity where useful, while keeping BunnyHub's existing features and adding its own platform capabilities. It does not copy Cinema4U code, branding or assets.

| Reference capability | BunnyHub implementation | State |
|---|---|---|
| Movies | Movie catalog, detail modal, search, genre and industry browsing | Existing |
| TV Shows | Web Series catalog with TV Shows / Web Series navigation label | Existing and refined |
| Seasons | Season-number grouping inside each series | Added |
| Episodes | Admin episode publishing, per-episode quality links, watch action, deletion and series relationship validation | Added; SQL migration required |
| Last Entries | Homepage newest-entry rail sorted by created_at | Refined |
| Release year | Dynamic release-year filters on Movies and TV Shows | Added |
| Genres | Genre discovery and catalog filters | Existing and refined |
| Popular Content | Real 30-day content-detail view ranking, view counts and Most viewed sorting | Existing and refined; SQL migration required |

## BunnyHub capabilities retained and extended

- Shorts and short-video upload flow
- Quality-aware player and signed downloads
- Subtitle metadata, watch progress and continue watching
- User registration, profiles, watchlist and content requests
- Admin dashboard, catalog management, reports, user management and staff roles
- Private Supabase media and Backblaze B2 / Cloudflare R2 support
- Google Drive public shared-video import
- HyperOS Aurora, ColorOS Ocean, AMOLED Black and Light Glass themes
- UPI donations with manual UTR verification
- AdSense placements, ads.txt and live earnings API
- Telegram bot commands, request notifications and publish announcements
- Community suggestions, bug reports, complaints and voting
- Privacy, terms and copyright information pages

## Important differences and honest limitations

BunnyHub uses its own Supabase schema, Cloudflare Pages Functions and private object storage. A provider appearing in the storage selector does not mean its official OAuth/upload connector is configured. B2, R2 and Supabase have upload paths; other providers remain authorised-link based until their provider-specific integration and credentials are completed.

AdSense earnings require account approval and OAuth credentials. Personalised advertising in the EEA, UK and Switzerland requires a Google-certified CMP integrated with IAB TCF. Donations currently use UPI intent and manual reference verification, not automatic bank settlement.

The feature upgrade SQL bundle must be applied before the new database-backed episode, donation, community and popular-content capabilities can be considered ready for final testing.
