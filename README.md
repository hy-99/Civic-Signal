# CivicSignal

CivicSignal CaseOps is a civic incident case-management and risk intelligence platform that turns citizen hazard reports and public signals into evidence clusters, managed incident cases, official zones, and responder workflows.

## Product Vision

- Collect citizen-submitted local hazard reports.
- Combine them with public alerts, weather, traffic, RSS, and admin-managed feeds.
- Score risk and confidence separately.
- Cluster related evidence into explainable civic risk situations.
- Promote serious clusters into managed incident cases with audit timelines.
- Support moderation, false-alarm handling, community verification, official zones, responder updates, UiPath-ready case orchestration stubs, and demo mode.

## Core Features

- Landing page and serious civic dashboard UI
- Real map command center with MapLibre, free OpenStreetMap raster fallback, and clickable risk clusters
- Citizen report submission with validation and optional image upload
- Report and cluster detail views with score explanations
- Community confirmation, dispute, resolution, and duplicate flows
- Public signal feed plus source-feed admin scan shell
- Moderator review queue and moderation logging
- CaseOps incident cases with linked reports/clusters, danger zones, and audit events
- Role mode switching for Citizen, Moderator, Government, and Responder inside the settings menu
- Official active/predicted zone data model with GeoJSON polygons and route compatibility
- Gemini-ready AI triage with deterministic rule fallback when no API key is configured
- Demo mode that works without paid APIs
- Supabase-ready SQL schema, RLS policies, and storage/auth wrappers
- Public-space categories for school-area concerns, public disturbances, unauthorized vending concerns, and crowd safety

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zod
- React Hook Form
- Lucide icons
- MapLibre GL JS with free OpenStreetMap raster fallback
- Gemini API support with deterministic fallback
- Supabase-ready data access
- Demo JSON persistence fallback

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Start the app:

```bash
npm run dev
```

`npm run dev` is guarded to use a single CivicSignal server on port `3000`. If it is already running, the command prints the existing URL instead of switching to `3002`.

4. Run checks:

```bash
npm run lint
npm run test
npm run check:brand
```

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_MAP_STYLE_URL=
NEXT_PUBLIC_SATELLITE_TILE_URL=
NEXT_PUBLIC_TERRAIN_TILE_URL=
NEXT_PUBLIC_DEFAULT_LAT=37.7749
NEXT_PUBLIC_DEFAULT_LNG=-122.4194
NEXT_PUBLIC_DEFAULT_CITY=CivicSignal Bay Demo

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_VISION_MODEL=gemini-2.5-flash
NEWS_API_KEY=
GEOCODING_PROVIDER=
GEOCODING_API_KEY=

APP_ENV=development
NEXT_PUBLIC_DEMO_MODE=true
```

`NEXT_PUBLIC_MAP_STYLE_URL` is optional. When it is not set, CivicSignal uses free OpenStreetMap raster tiles for the local demo map; when it is set, MapLibre loads that style URL. `NEXT_PUBLIC_SATELLITE_TILE_URL` and `NEXT_PUBLIC_TERRAIN_TILE_URL` can provide optional raster imagery without making Google Maps a dependency.

## Demo Mode

- Demo mode is the default local path when Supabase is not configured.
- Mutable demo data is stored in `.demo-storage/demo-state.json`.
- Demo uploads are stored in `.demo-storage/report-images/`.
- Seeded demo personas exist for resident, moderator, and admin roles.
- `POST /api/demo/reset` restores curated demo data and removes generated audit submissions while demo mode is enabled.

## Supabase Setup

- Apply the SQL files in `src/db/schema.sql`, `src/db/rls.sql`, and optionally `src/db/seed.sql`.
- Configure Auth, Storage, and Row Level Security.
- Create a public storage bucket named `civicsignal-report-images` or adjust the constant.
- The runtime attempts Supabase first and falls back to demo storage if unavailable.

## Database Schema

Main tables:

- `profiles`
- `reports`
- `public_signals`
- `risk_clusters`
- `incident_cases`
- `danger_zones`
- `case_events`
- `cluster_items`
- `report_votes`
- `cluster_votes`
- `report_updates`
- `source_feeds`
- `moderation_actions`
- `geocode_cache`
- `ai_cache`
- `categories`

## Running Locally

- `npm run dev`: start the app on a guarded fixed port
- `npm run dev:stop`: stop the CivicSignal dev server on the configured port
- `npm run lint`: run ESLint
- `npm run test`: run the service-level test suite
- `npm run check:brand`: fail if banned names appear in source files

## Free-Tier Strategy

- Rule-based scoring before optional AI
- Cached geocoding and AI outputs
- Manual or low-frequency source scans
- Images only, with size limits
- Demo mode when external services are missing
- Stored score explanations instead of recomputation on every render

## Safety and Privacy Rules

- CivicSignal focuses on places, hazards, infrastructure, and public conditions
- It does not score private people or accuse individuals
- Reports use careful language and confidence labeling
- Sensitive reports with named people, private details, or absolute accusations are held for moderation before public display
- Hidden and false-alarm content is excluded from public views
- Moderation actions are logged

## Roadmap

- Real RSS integrations
- Weather alerts
- Traffic alerts
- Gemini-backed AI triage tuning
- Push notifications
- City and organization dashboards
- Mobile app
- Offline reporting
- Emergency simulation mode
- Advanced duplicate detection
- Reputation and trust system
- Multilingual reporting
- Public API
- School and event safety layers
