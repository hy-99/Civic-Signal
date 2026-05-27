# CivicSignal Backend Upgrade — Implementation Plan

**Status:** Draft v1 — handoff spec for Codex
**Owner:** project owner; reviewer: Claude
**Last updated:** 2026-05-26

This is the full plan for upgrading CivicSignal from a solid MVP backend into a global-hackathon-grade system. The plan is structured as a per-work-unit specification so it can be executed largely independently. Read top to bottom once before starting; obey the **Constraints** section without exception.

---

## 0. Workflow

1. **Codex implements** the work units below in the order in §11 (Sequencing).
2. After each work unit Codex commits or leaves a clear progress marker (e.g. `git status` shows expected files, or writes `PROGRESS.md` with what landed).
3. **Claude reviews** each completed unit (correctness, integration, edge cases, demo-mode parity, brand check) and fixes / polishes.
4. **Final verification** runs the full pipeline end-to-end, plus `npm run lint`, `npm run test`, `npm run check:brand`.

If you (Codex) hit a decision the spec doesn't cover, **prefer the option that keeps demo mode working without env vars** and leave a `// PLAN-DECISION: ...` comment for review.

---

## 1. Constraints (must follow — do not relax without explicit approval)

| # | Constraint | Why |
|---|---|---|
| C1 | **`src/app/page.tsx` must not change.** Landing page is locked. | User requirement. No exceptions. |
| C2 | **Free APIs only.** Approved list in §4. No paid services, no API keys that aren't free-tier. | User requirement. |
| C3 | **Demo mode must still work without env vars.** Every new feature has a deterministic in-memory / JSON fallback. | Hackathon demo machine may have no Supabase / no Gemini key. |
| C4 | **Read `node_modules/next/dist/docs/` before writing route handlers / server components.** This project's Next.js has breaking changes vs. public docs. | `AGENTS.md` rule. Ignoring this is the #1 cause of broken builds. |
| C5 | **Use Zod for any new validation** (schema in `src/lib/validation.ts` style). | Existing convention. |
| C6 | **TypeScript strict.** No `any` without a justifying comment. No `// @ts-ignore` without a justifying comment. | Existing convention. |
| C7 | **Don't break existing tests.** `npm run test` must stay green after every work unit. | Regression discipline. |
| C8 | **Brand check must pass.** `npm run check:brand` — see banned-names script in `scripts/`. | Existing convention. |
| C9 | **Persistence parity.** Anything written to Supabase has a demo-JSON equivalent in `.demo-storage/` (state.json or new dedicated file). | C3 ⊃ this. |
| C10 | **No paid model upgrades.** Stick to `gemini-2.5-flash` (configurable) and `text-embedding-004` for embeddings. Both are free-tier. | C2 ⊃ this. |
| C11 | **No long-lived process assumptions.** Vercel/serverless may kill a request after ~10s. Anything longer goes through the scheduler (work unit D). | Production reality. |

---

## 2. Goals

Transform CivicSignal from a single-request CRUD app into a live, multi-source, multi-agent civic intelligence platform. Specifically:

- **Real-time:** dashboards update without page refresh.
- **Real data:** at least three real external feeds (USGS quakes, NWS alerts, RSS) replacing the current mock items.
- **Smart clustering:** semantic similarity (embeddings) in addition to spatial/temporal.
- **Smart zones:** zones recompute themselves from cluster geometry; AI suggests adjustments.
- **Multi-agent AI:** three agents (Triage, Dispatcher, Verifier) collaborate on each case with visible reasoning.
- **Observability:** every AI call is traced, displayed, and replayable.
- **Background work:** scheduler runs periodic jobs (feed scan, cluster decay, AI re-triage, zone recompute).
- **Spatial intelligence:** H3 hex density heatmap, isochrone reach overlays.

---

## 3. Audit summary (current state, as of this plan)

Verified via code inspection on 2026-05-26.

| Subsystem | LOC | Status | Notes |
|---|---|---|---|
| Reports pipeline | 449 | Real | End-to-end, image upload, AI triage, scoring, clustering, case creation. |
| Scoring engine | 458 | Real | 23+ weighted factors, transparent, tested. |
| Clustering | 482 | Real-but-naive | Haversine + category + temporal window. No semantic matching. |
| AI / Gemini | 413 | Real | Vision + text. Caching. Deterministic fallback when no key. |
| Public signals | 180 | Real (data shape only) | Persistence works; ingestion is mocked. |
| Source feeds | 138 | **Mock** | `makeMockItems()` returns hardcoded weather/traffic. Never fetches real URLs. |
| Cases + audit | 402 | Real | Full state machine, audit timeline, hazard taxonomy. |
| Triage | 200 | Real | Single Gemini call; not multi-agent. |
| Moderation | 181 | Real (regex) | Deterministic, human-in-loop queue. |
| Zones | 31 | Real-but-admin-only | No auto-compute. Manual GeoJSON edits. |
| Supabase wiring | ~150 | Dual-mode | Bypasses RLS via service role; no transactions. |
| Realtime / background | 0 | **Missing** | Entirely request/response. |
| PostGIS / spatial intel | 0 | **Missing** | lat/lng floats, no geo types, no indexes. |
| Tests | ~200 | Light coverage | scoring + moderation + demo-data + env + clusters. |

API routes: 38 total (full list in §15). Real: ~30. Mock: ~8.

---

## 4. Approved external dependencies & APIs

All MIT or Apache 2.0 unless noted. All free-tier or fully free.

**npm packages to add:**

| Package | Version line | License | Why |
|---|---|---|---|
| `rss-parser` | ^3.x | MIT | Parse generic RSS feeds in unit B. |
| `@turf/turf` | ^7.x | MIT | Convex hull, buffer, point-in-polygon for unit E. |
| `h3-js` | ^4.x | Apache 2.0 | H3 hex binning for unit H. |
| `eventsource-parser` | ^3.x | MIT | SSE client-side parsing helper for unit A (optional; we can do raw). |

**External APIs (free, no key):**

| API | URL base | Use | Unit |
|---|---|---|---|
| USGS Earthquake | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/` | Real significant quakes | B |
| NWS Alerts (US) | `https://api.weather.gov/alerts/active` | Real active US weather alerts | B |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast` | Free current weather, no key | B |
| OSRM public | `https://router.project-osrm.org/route/v1/` | Free routing for isochrone (rate-limited; demo only) | H |
| Gemini (existing) | `https://generativelanguage.googleapis.com/v1beta/` | Existing AI calls + new `text-embedding-004` | C, F, G |

**No paid APIs allowed.** If a feature requires one, demo it with the free fallback and note the limitation.

---

## 5. Architecture overview (target state)

```
                    ┌──────────────────────────────────────┐
                    │  Client (dashboards, admin, maps)    │
                    │  subscribes to SSE event stream      │
                    └──────────────────────┬───────────────┘
                                           │ GET /api/events/stream
                                           ▼
              ┌────────────────────────────────────────────────────┐
              │            In-process Event Bus (unit A)           │
              │  emit  ◄──┐                                        │
              │           │  fanout SSE to subscribers w/ filters  │
              └──┬──┬──┬──┴──┬──┬──┬───────────────────────────────┘
                 │  │  │     │  │  │
        ┌────────┘  │  │     │  │  └─────────┐
        ▼           ▼  ▼     ▼  ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────────────┐
  │ Reports  │  │ Clusters │  │  Cases + agents  │
  │ pipeline │  │ semantic │  │  (unit F)        │
  │          │  │ (unit C) │  │                  │
  └────┬─────┘  └────┬─────┘  └────────┬─────────┘
       │             │                  │
       └────►Embeddings (unit C)        │
       │             │                  │
       └────►Zones auto-compute (unit E)│
                     │                  │
                     └──►AI traces (unit G)
                                 ▲
                                 │
                 ┌───────────────┴────────────────┐
                 │   Scheduler / Workers (unit D) │
                 │   - feed-scan     (calls B)    │
                 │   - cluster-decay              │
                 │   - zone-recompute (calls E)   │
                 │   - ai-retriage    (calls F)   │
                 └────────────────────────────────┘
                                 ▲
                                 │
                 ┌───────────────┴────────────────┐
                 │  Live Ingestion (unit B)       │
                 │  USGS · NWS · Open-Meteo · RSS │
                 └────────────────────────────────┘

   Spatial intelligence (unit H):
   - PostGIS migration (Supabase only; demo skips)
   - H3 hex bins for density heatmap
   - OSRM isochrones for response-time overlays
```

---

# Work Units

Each work unit has the same structure:
- **Goal**
- **Files to create / modify**
- **Algorithm / approach**
- **API surface**
- **Schema changes**
- **Acceptance criteria**
- **Risks**

---

## 6. Unit A — Real-time Event Bus + SSE Stream

**Goal:** Provide an in-process pub/sub bus and an HTTP SSE endpoint so dashboards update live as the system processes incidents.

### Files to create

```
src/lib/events/
  types.ts          — discriminated union of every event
  bus.ts            — EventEmitter + subscriber registry + filters
  sse.ts            — formatting helpers (event:, data:, retry:, heartbeat)
src/app/api/events/stream/route.ts   — SSE GET endpoint
src/hooks/use-event-stream.ts        — React client hook
src/tests/events.test.ts             — unit tests for bus + filters
```

### Files to modify

```
src/services/reports.ts     — emit on create, scored, clustered
src/services/clusters.ts    — emit on cluster.updated, cluster.merged
src/services/cases.ts       — emit on case.created, case.event_added, case.status_changed
src/services/signals.ts     — emit on signal.ingested, signal.classified
src/services/zones.ts       — emit on zone.computed, zone.approved
src/components/board/priority-board.tsx   — subscribe and update in-place
src/app/app/page.tsx                       — wire the hook (NOT the landing page; this is /app/app)
```

### Event taxonomy (`src/lib/events/types.ts`)

```ts
export type CivicEvent =
  | { type: "report.created"; report: Report }
  | { type: "report.scored"; report_id: string; risk_score: number; confidence_score: number }
  | { type: "report.clustered"; report_id: string; cluster_id: string; match_reason: "spatial" | "semantic" | "both" }
  | { type: "cluster.updated"; cluster: RiskCluster }
  | { type: "cluster.merged"; from_id: string; into_id: string }
  | { type: "case.created"; case: IncidentCase }
  | { type: "case.event_added"; case_id: string; event: CaseEvent }
  | { type: "case.status_changed"; case_id: string; from: string; to: string }
  | { type: "signal.ingested"; signal: PublicSignal; source: string }
  | { type: "signal.classified"; signal_id: string; result: ClassificationResult }
  | { type: "zone.computed"; zone: DangerZone; mode: "auto" | "predicted" | "ai_suggested" }
  | { type: "zone.approved"; zone_id: string }
  | { type: "ai.trace"; trace: AiTrace }
  | { type: "feed.scanned"; feed_id: string; items_added: number };

export type EventName = CivicEvent["type"];
```

### Bus contract (`src/lib/events/bus.ts`)

```ts
type Subscriber = { id: string; filter?: (e: CivicEvent) => boolean; emit: (e: CivicEvent) => void };

export const bus = {
  emit(event: CivicEvent): void,
  subscribe(sub: Subscriber): () => void,   // returns unsubscribe
  subscribers(): number,                     // for debug/metrics
};
```

- Uses a `Set<Subscriber>` internally. `emit` is sync.
- No retries, no persistence: events are ephemeral. Persistence belongs to the underlying services.
- Heartbeat: each SSE subscriber gets a `: heartbeat\n\n` comment every 15s.

### SSE endpoint (`src/app/api/events/stream/route.ts`)

```ts
export const runtime = "nodejs";   // long-lived connection; do NOT use edge

GET /api/events/stream?roles=responder,gov&categories=fire,flood&types=case.created,zone.computed
```

- Validates query with Zod.
- Subscribes a filtered subscriber on connect.
- Streams `event: <name>\ndata: <json>\n\n` lines.
- Cleans up on `req.signal.aborted`.

### Client hook (`src/hooks/use-event-stream.ts`)

```ts
useEventStream({
  types?: EventName[];
  onEvent: (e: CivicEvent) => void;
})
```

- Wraps `new EventSource("/api/events/stream?...")`.
- Auto-reconnect with exponential backoff.
- Cleans up on unmount.

### Algorithm / behavior

- The bus is process-local. In serverless production this means each lambda has its own bus → events emitted in lambda A don't reach SSE listener in lambda B.
- Acceptable for hackathon demo (long-running `next dev` keeps single process).
- For production-correctness, **leave a TODO** noting that this should be backed by Supabase Realtime or Redis pub/sub. Do not implement that now.

### Acceptance criteria

- [ ] Open the dashboard at `/app`. Submit a report from a second tab. Within 500ms, the new report appears on the dashboard without refresh.
- [ ] Curl test: `curl -N http://localhost:3000/api/events/stream` emits heartbeats; submitting a report streams a `report.created` event.
- [ ] Filter test: `?types=case.created` only streams case events.
- [ ] Connection cleanup: kill the curl; server logs show subscriber unsubscribed.
- [ ] `src/tests/events.test.ts` covers: emit/subscribe basic, filter, unsubscribe, multiple subscribers.

### Risks

- Edge runtime kills connection: hence `runtime = "nodejs"`. Verify.
- Heartbeat formatting must use `\n\n` (two newlines). Browser SSE parsers are strict.
- React 19 strict mode mounts effects twice in dev — hook must be idempotent.

---

## 7. Unit B — Live Source Feed Ingestion

**Goal:** Replace `src/services/source-feeds.ts → makeMockItems()` with real external data parsers. Three real sources minimum: USGS, NWS, RSS. Bonus: Open-Meteo.

### Files to create

```
src/services/ingestion/
  index.ts                  — public surface: scanFeed(feed) → Signal[]
  parsers/
    rss.ts                  — generic RSS via rss-parser
    usgs.ts                 — earthquake geojson
    nws.ts                  — National Weather Service alerts
    open-meteo.ts           — current weather snapshot
  dedup.ts                  — external_id-based dedup against existing signals
  geocode-from-feed.ts      — extract lat/lng from feed entries; fallback to default city
src/tests/ingestion.test.ts
```

### Files to modify

```
src/services/source-feeds.ts     — remove makeMockItems(); call ingestion/index.ts
src/app/api/admin/sources/[id]/scan/route.ts   — call real scan
src/app/api/admin/sources/[id]/test/route.ts   — call real test (single-item preview)
src/db/schema.sql                — add external_id column to public_signals (UNIQUE per source_id)
src/lib/data-store.ts            — handle new column in demo + supabase paths
src/services/signals.ts          — accept external_id field; dedup by it
```

### Algorithm / approach

**Generic flow per scan:**

```
fetch(feed.url) → raw items → parser → normalised PublicSignalInput[] →
dedup by external_id → for each new item:
  - geocode if no lat/lng (use existing geocoding service)
  - run AI classifier (existing services/ai.ts → classifyPublicSignal)
  - score (existing scoring path)
  - persist
  - bus.emit({type: "signal.ingested", signal, source: feed.kind})
return summary {fetched, added, duplicates, errors}
```

**Parser specs:**

- `parsers/usgs.ts` — GET `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson` → for each feature: `external_id = feature.id`; lat/lng from `geometry.coordinates`; severity from `properties.mag` (>= 6 → severity high, 4-6 → medium, <4 → low); title `M${mag} - ${place}`; category `natural_hazard`.

- `parsers/nws.ts` — GET `https://api.weather.gov/alerts/active?status=actual&message_type=alert&limit=50` → for each feature: `external_id = id`; description = headline + areaDesc; severity from `severity` field; category mapped from `event` (e.g. "Flood Warning" → `flooding`).

- `parsers/open-meteo.ts` — GET `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m` → produce at most one signal per scan, *only* if a hazardous condition (wind > 15 m/s, weather_code in extreme set). Avoids spamming the feed with normal weather.

- `parsers/rss.ts` — generic, via `rss-parser`. Honors per-feed `category_default`, `severity_default` on the SourceFeed record.

**User-Agent header:** All HTTP fetches must send `User-Agent: CivicSignal/1.0 (hackathon-demo; contact: <env.CIVICSIGNAL_CONTACT or empty>)` — NWS rejects requests without it.

**Timeouts:** wrap all fetches with `AbortSignal.timeout(8000)`. Network failures must be logged but not crash the scan; return partial results.

### Default seed feeds (auto-added in demo mode)

On first boot in demo mode, ensure these `source_feeds` rows exist (idempotent — match by `kind + url`):

```
[
  { name: "USGS Significant Earthquakes", kind: "usgs",       url: "<usgs significant_day>" },
  { name: "NWS Active Alerts (US)",        kind: "nws",        url: "<nws active>" },
  { name: "Open-Meteo (default city)",      kind: "open_meteo", url: "<open-meteo with env defaults>" },
  { name: "Example RSS — SF Bay Hazards",   kind: "rss",        url: "https://www.weather.gov/source/news/Bay-Area-RSS.xml" }
]
```

(Codex: confirm the RSS URL works at implementation time; substitute if not. Any free public hazard RSS is fine.)

### Schema changes

```sql
-- src/db/schema.sql
ALTER TABLE public_signals ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS public_signals_source_external_uniq
  ON public_signals (source_id, external_id) WHERE external_id IS NOT NULL;
```

Demo storage: add `external_id` to the `PublicSignal` type in `src/lib/types.ts`.

### API surface

No new public endpoints. The existing `POST /api/admin/sources/[id]/scan` is repointed to the real parser. Response shape unchanged.

### Acceptance criteria

- [ ] Admin → Sources page → click "Scan" on USGS feed → at least one real earthquake appears in signals (or feed reports "no new significant quakes" if none in the last 24h).
- [ ] Admin → Sources page → "Scan" on NWS feed → real US weather alerts appear.
- [ ] Re-running scan does NOT create duplicates (dedup via `external_id`).
- [ ] Open-Meteo scan only creates a signal when conditions exceed thresholds (verify by toggling thresholds in test).
- [ ] RSS scan parses a known feed correctly (test feed URL pinned in test).
- [ ] Every successful scan emits `feed.scanned` event with item count.
- [ ] Every new signal emits `signal.ingested` event (unit A).
- [ ] Demo mode: scanning works (real HTTP fetched) but persists to `.demo-storage/state.json`.

### Risks

- NWS rate-limits and requires User-Agent. Test early.
- RSS feed URLs decay. Hardcoded test URL must be a stable public feed.
- Network calls in tests must be mocked. Use existing test patterns; don't introduce a network dep in CI.

---

## 8. Unit C — Embedding-Based Semantic Clustering

**Goal:** Add semantic similarity to cluster matching using Gemini `text-embedding-004`. A report about "fallen oak tree blocking Main St" should cluster with a signal that says "huge branch down on Main Street" even though no exact keywords match.

### Files to create

```
src/services/embeddings.ts        — embed text, cache, vector ops
src/lib/vector.ts                  — cosine, normalise, dot
src/services/clusters/
  semantic-match.ts                — semantic + spatial + temporal scoring
src/tests/embeddings.test.ts
src/tests/semantic-match.test.ts
```

### Files to modify

```
src/services/ai.ts          — add generateEmbedding(text: string): Promise<number[]>
src/services/clusters.ts    — replace single matching call with combined matcher
src/services/reports.ts     — generate embedding on create, persist
src/services/signals.ts     — generate embedding on create, persist
src/lib/types.ts            — add embedding?: number[] to Report, PublicSignal, RiskCluster
src/db/schema.sql           — add embedding columns (see below)
src/lib/data-store.ts       — persist/load embedding columns in both paths
```

### Algorithm

**Per new report/signal:**
1. Build embedding input string: `${title} | ${description} | category=${category}` (truncated to 2048 chars).
2. Call `generateEmbedding(text)` → `number[768]`.
3. Cache by SHA256(text) in `ai_cache` table (existing).
4. Persist to `reports.embedding` / `public_signals.embedding`.

**Cluster matching (combined scorer):**

```ts
matchScore(item, cluster) =
  W_SPATIAL  * spatialScore(item.lat,lng, cluster.centroid)   // existing haversine
+ W_TEMPORAL * temporalScore(item.created_at, cluster.last_active_at)
+ W_SEMANTIC * cosine(item.embedding, cluster.embedding)
```

Weights (defaults, configurable in `src/lib/constants.ts`):
- `W_SPATIAL = 0.4`
- `W_TEMPORAL = 0.2`
- `W_SEMANTIC = 0.4`

Threshold for "match": combined score >= 0.62 (tunable). Take the best matching cluster or create a new one.

**Cluster embedding:** average of constituent reports' embeddings (re-normalised after each add).

### Schema changes

```sql
-- src/db/schema.sql
-- Best path: pgvector extension. If unavailable, fall back to float8[].
ALTER TABLE reports        ADD COLUMN IF NOT EXISTS embedding float8[];
ALTER TABLE public_signals ADD COLUMN IF NOT EXISTS embedding float8[];
ALTER TABLE risk_clusters  ADD COLUMN IF NOT EXISTS embedding float8[];

-- Optional but preferred (Supabase has pgvector available):
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE reports        ALTER COLUMN embedding TYPE vector(768) USING embedding::vector;
-- CREATE INDEX reports_embedding_idx ON reports USING ivfflat (embedding vector_cosine_ops);
```

Codex: if pgvector is straightforward in Supabase, prefer it. Otherwise float8[] is fine for hackathon scale.

### Demo mode

- `text-embedding-004` is free-tier on Gemini. With a key, real embeddings work.
- **Without a key:** fall back to a deterministic pseudo-embedding from `src/services/ai.ts` — hash the text → seed an RNG → 768-dim normalised vector. Use the existing deterministic fallback pattern. This will *not* cluster intelligently, but the code path runs identically. Mark this fallback clearly in logs.

### Acceptance criteria

- [ ] New report → row in DB has non-null `embedding` of length 768.
- [ ] Two reports with different keywords but same meaning cluster together (write a test with fixture text pairs).
- [ ] A `report.clustered` event carries `match_reason: "semantic"` when spatial proximity is poor but semantic similarity is high.
- [ ] Cosine similarity score appears in the cluster detail audit log: `"matched via semantic similarity 0.84"`.
- [ ] Embedding generation is cached: re-running on the same text doesn't re-call Gemini.
- [ ] `src/tests/semantic-match.test.ts` tests the combined scorer with mocked embeddings.

### Risks

- Embedding API rate limits: cache aggressively. For demo, pre-embed seed data.
- Float8[] columns: Supabase needs the row-size budget; truncating to 256 dimensions is acceptable if 768 causes problems.
- Pseudo-embedding fallback gives spurious clusters. Ensure tests use real embeddings via mock, not the fallback.

---

## 9. Unit D — Background Scheduler + Worker Queue

**Goal:** Run periodic jobs (feed scans, cluster decay, AI re-triage, zone recompute) on a schedule, with manual triggers for demo.

### Files to create

```
src/lib/scheduler/
  queue.ts          — in-memory FIFO with concurrency control
  runner.ts         — runs a single named job; logs duration, status
  jobs.ts           — registry: { "feed-scan": handler, ... }
src/workers/
  feed-scan.ts        — iterate active source_feeds, call ingestion (unit B)
  cluster-decay.ts    — decay risk scores by time; auto-resolve stale clusters
  zone-recompute.ts   — recompute auto-zones for active clusters (unit E)
  ai-retriage.ts      — re-run multi-agent triage on cases with stale ai_assessment (> 6h)
src/app/api/cron/[task]/route.ts   — protected trigger endpoint
src/components/admin/jobs-panel.tsx — manual trigger UI (admin only)
src/tests/scheduler.test.ts
```

### Files to modify

```
.env.example                  — add CRON_SECRET=
vercel.json                   — schedule entries (optional, demo runs manually)
src/app/app/admin/page.tsx    — render JobsPanel for moderator/government roles
```

### Algorithm

**Cron endpoint:**

```ts
POST /api/cron/[task]
Authorization: Bearer ${CRON_SECRET}
```

- Validates header against `process.env.CRON_SECRET`. Reject 401 otherwise.
- Looks up handler in `jobs.ts`; runs via `runner`.
- Emits `feed.scanned` / `cluster.updated` / etc. events.
- Returns `{ task, started_at, finished_at, summary }`.

**Manual trigger (admin UI):**

- Buttons "Run feed scan", "Run cluster decay", "Run zone recompute", "Run AI re-triage".
- Each posts to `/api/cron/[task]` with the secret (set on server side via env-derived helper; no secret leaked to client).
- Show last run timestamp + summary per task.

**Vercel config (optional, leave commented unless deploying):**

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/feed-scan",      "schedule": "*/5 * * * *" },
    { "path": "/api/cron/cluster-decay",  "schedule": "0 * * * *" },
    { "path": "/api/cron/zone-recompute", "schedule": "*/10 * * * *" },
    { "path": "/api/cron/ai-retriage",    "schedule": "0 */6 * * *" }
  ]
}
```

Note: Vercel cron sends a header; route should accept either bearer auth or `x-vercel-cron-signature` (per Vercel docs valid at impl time).

### Worker contracts

- `feed-scan({ feed_id?: string })`: if `feed_id` given, scan one; else iterate all `is_active` feeds.
- `cluster-decay()`: for each cluster, multiply `risk_score` by `exp(-Δt_hours / TAU)` where `TAU=72`. If score drops below 10 and cluster has no recent reports (>48h), auto-set status to `resolved`.
- `zone-recompute()`: for each active cluster, call `computeAutoZone(cluster)` from unit E; upsert zone with `mode=auto`.
- `ai-retriage()`: find cases where `ai_triage_at` is null or older than 6h and status not in `(resolved, false_alarm, rejected)`; run the multi-agent orchestrator (unit F).

### Acceptance criteria

- [ ] Without `CRON_SECRET`, the endpoint returns 401.
- [ ] With correct secret, each job runs and returns a summary.
- [ ] Admin UI buttons trigger jobs and display results.
- [ ] Running `feed-scan` 3 times in a row: 1st adds items, 2nd+3rd are no-ops (dedup).
- [ ] Running `cluster-decay` on a 7-day-old cluster reduces its score visibly.
- [ ] Logs include duration, items processed, errors.
- [ ] `src/tests/scheduler.test.ts` covers auth, dispatch, error handling.

### Risks

- Vercel cron is paid on some plans — keep it optional; the manual trigger always works.
- Long-running jobs can timeout. Each job must batch and yield (per-feed, per-cluster, per-case loops with try/catch).

---

## 10. Unit E — Auto-Zone Computation

**Goal:** Replace manual-only zone editing with auto-computed danger zones derived from cluster geometry, plus predicted zones from incident velocity, plus AI-suggested zone adjustments.

### Files to create

```
src/services/zones/
  auto-compute.ts        — convex hull + buffer
  predict.ts             — velocity-based prediction
  ai-suggest.ts          — Gemini-suggested polygon adjustments
src/lib/geo/
  hull.ts                — convex / concave hull
  buffer.ts              — polygon buffer in meters
src/tests/auto-zone.test.ts
```

### Files to modify

```
src/services/zones.ts          — orchestrate auto + predicted + ai_suggested
src/services/cases.ts          — invoke computeAutoZone() after case creation
src/components/admin/...       — UI: list pending auto-zones, approve / reject / merge
src/lib/types.ts               — DangerZone.mode: "auto" | "predicted" | "ai_suggested" | "manual"
src/db/schema.sql              — add `mode`, `approved_at`, `approved_by`, `parent_cluster_id` to danger_zones
```

### Algorithm

**`computeAutoZone(cluster, opts?)`:**

1. Collect points = linked reports' lat/lng + signals' lat/lng.
2. If <3 points → use a single point with circular buffer (default 200m).
3. Else compute convex hull (`@turf/convex`).
4. Buffer by `CATEGORY_RADIUS[cluster.category]` (default 200m, configurable).
5. Return GeoJSON Polygon; mode = `auto`.

**`predictZone(cluster)`:**

1. If cluster has <2 timestamped centroids in last 60min → return null.
2. Compute velocity vector = (centroid_now - centroid_60min_ago) / 60min.
3. Project centroid 30min forward.
4. Build buffered polygon around projection; mode = `predicted`.

**`aiSuggestZone(cluster, currentZone)`:**

1. Build prompt: cluster summary + linked items + currentZone polygon (simplified to <50 points).
2. Call Gemini with structured output schema requesting polygon adjustments and rationale.
3. Validate polygon (closed ring, ≥4 coords, valid lat/lng).
4. Return GeoJSON + rationale string; mode = `ai_suggested`.

### Approval flow

- All auto/predicted/ai_suggested zones land with `approved_at = null` and visible in admin UI.
- Government / moderator can approve → sets `approved_at`, `approved_by`.
- Only approved zones surface on the public map. Demo mode auto-approves to keep the demo flow clean (configurable via `env.AUTO_APPROVE_ZONES`).

### Schema changes

```sql
ALTER TABLE danger_zones
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS parent_cluster_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;
```

### Acceptance criteria

- [ ] New cluster with 3+ reports → auto-zone appears on map (after approval in non-demo mode).
- [ ] Predicted zone arrow visible when cluster has tracked movement.
- [ ] AI-suggested zone shows rationale on hover.
- [ ] Approve button moves zone to public layer; emits `zone.approved`.
- [ ] Tests: convex hull on 3 colinear points handles edge case; buffer of 0 returns input polygon.

### Risks

- Convex hull of <3 points fails. Always fall back to circle.
- AI-suggested polygons can be malformed; validate aggressively, reject silently if invalid.

---

## 11. Unit F — Multi-Agent Case Triage

**Goal:** Replace the single Gemini call in `src/services/case-triage.ts` with three cooperating agents whose reasoning is visible in the audit log.

### Files to create

```
src/services/agents/
  prompts.ts          — all three system prompts, single source of truth
  schemas.ts          — Zod schemas for structured outputs
  triage-agent.ts     — assesses urgency, severity, hazard_type
  dispatcher-agent.ts — assigns role, suggests zone, priority
  verifier-agent.ts   — LLM-as-judge; flags conflicts; suggests adjustments
  orchestrator.ts     — runs all three sequentially; emits events; writes case_events
src/tests/agents.test.ts
```

### Files to modify

```
src/services/case-triage.ts   — keep as thin shim that delegates to orchestrator
src/services/cases.ts          — invoke orchestrator on case create + via worker re-triage
src/components/cases/...       — UI panel showing each agent's structured output + verifier verdict
```

### Agent contracts

**TriageAgent.analyze(input):**

```ts
input: {
  case: IncidentCase;
  reports: Report[];
  signals: PublicSignal[];
}
output: {
  hazard_type: HazardType;
  urgency: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: number;        // 0-1
  evidence_summary: string;  // <= 240 chars, no PII
  reasoning: string;         // visible in audit; <= 600 chars
}
```

**DispatcherAgent.dispatch(triage):**

```ts
input: TriageAgent.output + { available_roles: ResponderRole[] }
output: {
  assigned_role: ResponderRole;     // fire | police | public_works | medical | utilities
  zone_suggestion: { buffer_m: number; shape_hint: "convex" | "directional" | "circle" };
  response_priority: "p1" | "p2" | "p3" | "p4";
  reasoning: string;
}
```

**VerifierAgent.judge(triage, dispatch, raw_input):**

```ts
output: {
  agree: boolean;
  conflicts: string[];          // e.g. ["urgency=5 but no image evidence"]
  adjustments: Partial<TriageAgent.output & DispatcherAgent.output>;
  reasoning: string;
}
```

### Orchestrator behavior

```
1. triage_result = TriageAgent.analyze(...)
   bus.emit({ type: "case.event_added", case_id, event: { actor_type: "ai", actor_name: "triage_agent", payload: triage_result }})
2. dispatch_result = DispatcherAgent.dispatch(triage_result)
   bus.emit(... actor_name: "dispatcher_agent" ...)
3. verdict = VerifierAgent.judge(triage_result, dispatch_result, raw)
   bus.emit(... actor_name: "verifier_agent" ...)
4. if !verdict.agree:
     apply verdict.adjustments to case (and log a "case.status_changed" or similar event)
5. persist final ai_assessment object on the case.
```

All three calls funnel through `src/services/ai.ts` → traced (unit G).

### Fallback (no Gemini key)

Existing rule-based fallback in `case-triage.ts` is moved into `TriageAgent`. Dispatcher fallback: deterministic role mapping per hazard_type. Verifier fallback: always returns `agree: true` with empty conflicts. This keeps the audit log shape identical in demo mode.

### Acceptance criteria

- [ ] New case → exactly 3 new case_events appear in audit log, one per agent, each with structured payload and human-readable reasoning.
- [ ] Verifier sometimes disagrees (test with a crafted case that has conflicting evidence).
- [ ] Disagreement results in visible "Adjusted by verifier" annotation on the case.
- [ ] All three agent outputs survive Zod validation; malformed responses are retried once then fall back.
- [ ] Latency budget: end-to-end ≤ 6 seconds with real Gemini; ≤ 200ms with fallback.

### Risks

- 3× Gemini calls per case is 3× the cost. Caching by input hash (already exists) helps for re-triage.
- Verifier loops infinitely if it disagrees forever. **No loop:** verifier runs exactly once; if it disagrees, adjustments are applied as a single edit, and we move on.

---

## 12. Unit G — AI Pipeline Traces & Replay

**Goal:** Every AI call in the system is recorded with inputs, outputs, latency, and cost estimate, viewable in an admin page, with a "replay" button to re-run a single call.

### Files to create

```
src/services/observability/
  traces.ts           — startTrace, finishTrace, listTraces, replayTrace
  cost-estimator.ts   — naive token-to-cents using public Gemini pricing
src/app/app/observability/
  page.tsx            — list + filter + drill-down view
  trace-detail.tsx
src/app/api/admin/traces/route.ts
src/app/api/admin/traces/[id]/route.ts
src/app/api/admin/traces/[id]/replay/route.ts
src/tests/traces.test.ts
```

### Files to modify

```
src/services/ai.ts           — wrap every fetch call with trace logger
src/services/agents/*.ts     — auto-included via ai.ts wrapping
src/lib/types.ts             — add AiTrace type
src/db/schema.sql            — create ai_traces table
src/lib/data-store.ts        — read/write ai_traces in both modes
```

### Schema

```sql
CREATE TABLE IF NOT EXISTS ai_traces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     uuid REFERENCES ai_traces(id),
  agent_name    text,                  -- "triage_agent" | "image_analyzer" | "embedding" | null
  model         text NOT NULL,
  input_hash    text NOT NULL,
  input_excerpt text NOT NULL,         -- first 600 chars
  output_excerpt text,                 -- first 600 chars
  prompt_tokens int,
  completion_tokens int,
  latency_ms    int NOT NULL,
  status        text NOT NULL,         -- "ok" | "error" | "fallback"
  error_message text,
  cost_estimate_cents int,
  related_entity_type text,             -- "report" | "case" | "signal" | "cluster"
  related_entity_id   uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_traces_created_idx       ON ai_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_traces_related_entity_idx ON ai_traces (related_entity_type, related_entity_id);
```

### API surface

- `GET /api/admin/traces?limit=50&entity_type=case&entity_id=...` → list (paged).
- `GET /api/admin/traces/[id]` → single trace incl. full input and output bodies (server-side only).
- `POST /api/admin/traces/[id]/replay` → re-run with the original input; returns the new trace id. Bound by RLS / admin role.

### UI

- `/app/observability` (admin only): table with timestamp, agent, model, entity, status, latency, cost.
- Drill-down: full input / output, replay button.
- "Show traces for this case" link on case-detail.

### Acceptance criteria

- [ ] Submitting a report produces 5–10 traces (vision, embedding, classification, triage agents, etc.).
- [ ] Each trace has model name and latency.
- [ ] Replay button re-runs the call and links to the new trace.
- [ ] Cost estimate is non-zero for real Gemini calls and zero for fallback calls.
- [ ] Traces list paginates.
- [ ] Trace creation never blocks the parent operation: errors logging traces must be swallowed.

### Risks

- Storing full inputs/outputs can be sensitive. Excerpt only (600 chars) by default; full bodies behind a separate endpoint guarded by role.
- Trace writes shouldn't double the latency. Use `Promise.resolve().then(...)` non-blocking write.

---

## 13. Unit H — PostGIS + H3 Hex Density + Isochrones

**Goal:** Layer real spatial intelligence on top of the existing map: density heatmap (H3 hex bins), response-time reachability (OSRM isochrones).

### Files to create

```
src/services/spatial/
  h3-bins.ts          — bucket reports/signals by H3 cell, compute density score
  isochrone.ts        — OSRM driving polygons around a point at N minutes
src/app/api/spatial/
  heatmap/route.ts    — GET ?resolution=8&since=24h → cells + scores
  isochrone/route.ts  — GET ?lat=&lng=&minutes=10
src/components/map/
  heatmap-layer.tsx   — MapLibre layer wired to /api/spatial/heatmap
  isochrone-layer.tsx
src/db/migrations/postgis.sql   — optional Supabase migration
src/tests/spatial.test.ts
```

### Files to modify

```
src/components/map/...     — toggle in map UI for heatmap and isochrone overlays
src/lib/types.ts           — H3Cell, IsochronePolygon types
```

### Algorithm

**H3 binning:**

1. Choose resolution by zoom (resolution=7 at city scale, 9 at neighborhood).
2. For each report+signal in time window: compute H3 cell at resolution.
3. Count + weight by `risk_score` per cell.
4. Output: `{cells: [{h3: string, count: int, weight: number, polygon: GeoJSON}], max_weight: number}`.

**Isochrones:**

1. Given (lat, lng, minutes) → call `https://router.project-osrm.org/route/v1/driving/${lng},${lat};...` is not the right endpoint for isochrones. **Honest note:** OSRM public doesn't expose isochrones directly. Two paths:
   - Use a fan of routing calls at compass headings (16 directions, time-bounded). Build a polygon from endpoints. Approximate but free.
   - **Or** use OpenRouteService public isochrone (free with key — discouraged per C2).
   - Decision: fan-of-routes via OSRM, free and keyless. Acceptable for demo.

2. Cache results by (lat,lng,minutes) bucketed to 0.001° for 1h.

**PostGIS migration (optional, only if Supabase configured):**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE reports        ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
ALTER TABLE public_signals ADD COLUMN IF NOT EXISTS geom geography(Point, 4326);
UPDATE reports        SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE lat IS NOT NULL;
UPDATE public_signals SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_geom_idx        ON reports        USING gist (geom);
CREATE INDEX IF NOT EXISTS public_signals_geom_idx ON public_signals USING gist (geom);
```

Demo mode: H3 bins computed in JS. Skip PostGIS migration.

### Acceptance criteria

- [ ] Map UI has a "Density" toggle that overlays H3 hex polygons colored by report weight.
- [ ] Map UI has a "Reach" toggle that, when a point is selected, draws a 10-minute drive polygon.
- [ ] Heatmap recomputes when the time-window filter changes.
- [ ] Resolution adapts to zoom level.
- [ ] Tests cover H3 cell math with fixture points.

### Risks

- OSRM public is rate-limited (~1 req/s). Cache aggressively and disable for non-admin users.
- Fan-of-routes is computationally lazy. Acceptable for demo; flag for future replacement.

---

## 14. Sequencing

```
Day 1 (foundations):
  A — Event bus + SSE                   ← unlocks live demo
  D — Scheduler + cron                  ← required by B

Day 2 (real data + smart clustering):
  B — Live feeds (depends on A, D)
  C — Embeddings + semantic clustering  ← parallelizable with B

Day 3 (intelligence on top):
  E — Auto-zones (uses C cluster outputs)
  F — Multi-agent triage (uses A for visibility)

Day 4 (observability + spatial):
  G — Traces + replay (orthogonal; can land anytime after F)
  H — PostGIS + H3 + isochrones         ← parallelizable with G

End: integration polish + tests + demo script.
```

**Hard dependencies:**
- B depends on D (cron entry point exists; can also run manually). Manual triggers from admin UI work without cron.
- E depends on C (cluster centroids more meaningful with semantic groupings).
- F doesn't depend on others but lights up much better when A is live.
- G touches every unit's AI calls — implement last to avoid churn.

---

## 15. Existing API routes inventory

Listed for completeness. Modifications by work unit are noted.

| Group | Route | Method | Touched by |
|---|---|---|---|
| auth | `/api/auth/login` | POST | — |
| auth | `/api/auth/logout` | POST | — |
| auth | `/api/auth/signup` | POST | — |
| reports | `/api/reports` | GET, POST | C, F, G |
| reports | `/api/reports/[id]` | GET, PATCH | — |
| reports | `/api/reports/[id]/vote` | POST | — |
| reports | `/api/reports/[id]/updates` | POST | — |
| risks | `/api/risks` | GET | — |
| risks | `/api/risks/[id]` | GET | — |
| risks | `/api/risks/[id]/recalculate` | POST | C |
| risks | `/api/risks/[id]/updates` | POST | — |
| risks | `/api/risks/[id]/vote` | POST | — |
| risks | `/api/risks/merge` | POST | — |
| signals | `/api/signals` | GET, POST | B, C |
| signals | `/api/signals/[id]/analyze` | POST | C, G |
| signals | `/api/signals/[id]/match` | POST | C |
| signals | `/api/signals/[id]/ignore` | POST | — |
| cases | `/api/cases` | GET, POST | F |
| cases | `/api/cases/[id]` | GET | — |
| cases | `/api/cases/[id]/events` | POST | F |
| admin | `/api/admin/review` | GET, POST | — |
| admin | `/api/admin/moderate` | POST | — |
| admin | `/api/admin/sources` | GET, POST | B |
| admin | `/api/admin/sources/[id]/test` | POST | B |
| admin | `/api/admin/sources/[id]/scan` | POST | B |
| admin | `/api/admin/users` | GET | — |
| admin | `/api/admin/analytics` | GET | — |
| zones | `/api/zones` | GET | E |
| uipath | `/api/uipath/*` | POST | — |
| upload | `/api/upload/report-image` | POST | — |
| geocode | `/api/geocode` | GET | — |
| geocode | `/api/reverse-geocode` | POST | — |
| demo | `/api/demo/reset` | POST | — |
| **NEW** | `/api/events/stream` | GET | A |
| **NEW** | `/api/cron/[task]` | POST | D |
| **NEW** | `/api/admin/traces` | GET | G |
| **NEW** | `/api/admin/traces/[id]` | GET | G |
| **NEW** | `/api/admin/traces/[id]/replay` | POST | G |
| **NEW** | `/api/spatial/heatmap` | GET | H |
| **NEW** | `/api/spatial/isochrone` | GET | H |

---

## 16. Schema diff summary

```sql
-- Unit B
ALTER TABLE public_signals ADD COLUMN external_id text;
CREATE UNIQUE INDEX public_signals_source_external_uniq
  ON public_signals (source_id, external_id) WHERE external_id IS NOT NULL;

-- Unit C
ALTER TABLE reports        ADD COLUMN embedding float8[];
ALTER TABLE public_signals ADD COLUMN embedding float8[];
ALTER TABLE risk_clusters  ADD COLUMN embedding float8[];
-- preferred upgrade: CREATE EXTENSION vector;  then vector(768) + ivfflat index

-- Unit E
ALTER TABLE danger_zones
  ADD COLUMN mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN parent_cluster_id uuid,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid;

-- Unit G
CREATE TABLE ai_traces ( ... see §12 ... );
CREATE INDEX ai_traces_created_idx ON ai_traces (created_at DESC);
CREATE INDEX ai_traces_related_entity_idx ON ai_traces (related_entity_type, related_entity_id);

-- Unit H (optional, Supabase only)
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE reports        ADD COLUMN geom geography(Point, 4326);
ALTER TABLE public_signals ADD COLUMN geom geography(Point, 4326);
CREATE INDEX reports_geom_idx        ON reports        USING gist (geom);
CREATE INDEX public_signals_geom_idx ON public_signals USING gist (geom);
```

`src/db/rls.sql` updates: extend SELECT/INSERT policies to cover new columns. Read existing RLS file and follow the same role-based pattern.

---

## 17. Testing strategy

**Unit tests (Jest, in `src/tests/`):**
- `events.test.ts` — bus emit/subscribe/filter/unsubscribe.
- `ingestion.test.ts` — parsers with fixture HTTP responses (mocked via msw or manual `fetch` mock).
- `semantic-match.test.ts` — combined matcher with mocked embeddings; clustering thresholds.
- `embeddings.test.ts` — caching, fallback determinism.
- `scheduler.test.ts` — auth, dispatch, error handling, retry policy.
- `agents.test.ts` — each agent's structured output validation; orchestrator sequencing; verifier disagreement path.
- `auto-zone.test.ts` — convex hull edge cases; buffer math; predict velocity.
- `traces.test.ts` — trace creation, replay, non-blocking write.
- `spatial.test.ts` — H3 cell counts; isochrone caching.

**Integration test:**
- `src/tests/pipeline.e2e.test.ts` — submit a report end-to-end; assert: embedding generated, cluster matched or created, case created, 3 agent events appear, zone proposed, all 3 traces logged, events emitted on bus.

**Manual / demo walkthrough:** see §18.

---

## 18. Demo script

A 2-3 minute walkthrough that hits every new feature:

1. Open `/app` dashboard in tab 1.
2. Open `/app/observability` (admin) in tab 2.
3. Open the public landing page (tab 3) — **untouched**.
4. In a 4th tab, submit a citizen report ("flooding on Main and 5th, water rising fast", with an image).
5. Watch tab 1: within ~1s, the report marker appears on the map; cluster auto-forms; case is created; three AI agents add events to the case timeline (Triage → Dispatcher → Verifier); auto-zone appears around the cluster.
6. In tab 2: refresh — five new traces show up. Click one → drill-down. Click "Replay" → confirms it re-runs.
7. Admin → Sources → click "Scan USGS". Real earthquake signal appears (or message "no significant quakes in last 24h").
8. Admin → Run "Cluster decay" manually. An old cluster's score drops.
9. Map → toggle "Density heatmap" — H3 hex layer overlays. Toggle "Reach" with a clicked point — isochrone polygon draws.

Each step is observable in the SSE event log (devtools network tab streaming).

---

## 19. Files NOT to touch

- `src/app/page.tsx` (landing). Absolutely no changes.
- Any file in the landing-page assets used only by `/`.

Everything else (including `src/app/app/*`, `src/services/*`, `src/db/*`, `src/components/*`) is fair game.

---

## 20. Handoff checklist (Codex → Claude)

Before handing back for review, Codex should:

- [ ] All work units implemented per spec (or note explicit deviations).
- [ ] `npm run lint` clean.
- [ ] `npm run test` green.
- [ ] `npm run check:brand` green.
- [ ] `.env.example` updated with any new variables (`CRON_SECRET`, etc.).
- [ ] `README.md` updated with new env vars + new feature list (NOT the landing page).
- [ ] `PROGRESS.md` at repo root with one paragraph per completed work unit + open questions.
- [ ] Manual demo script (§18) walked through once, with screenshots or `console.log` evidence of each step.

Claude will then:
1. Diff every changed file.
2. Validate acceptance criteria per unit.
3. Run the demo script.
4. Fix integration issues, polish UI copy, tighten types, harden error handling.
5. Run final `npm run lint && npm run test && npm run check:brand`.

---

## 21. Open questions for the project owner

These don't block Codex; defaults are chosen, but flag for user confirmation later:

1. **Auto-approve zones in demo mode?** Plan default: yes. If no, demo will need an admin click to surface zones.
2. **Embedding fallback in no-key mode** generates deterministic pseudo-embeddings. Acceptable, or skip semantic matching entirely when no key?
3. **Vercel cron** is optional and possibly paid on some plans. Plan default: manual triggers always work; cron config is commented out.
4. **OSRM isochrones via fan-of-routes** is approximate. Acceptable for demo? If not, the only free alternative is ORS (key required, free tier) — vetoed by C2.

---

## 22. Glossary

- **SSE** — Server-Sent Events, one-way HTTP push.
- **H3** — Uber's hexagonal hierarchical geospatial indexing.
- **Isochrone** — polygon enclosing all points reachable within N minutes.
- **PostGIS** — Postgres spatial extension.
- **pgvector** — Postgres vector extension for embedding indexes.
- **OSRM** — Open Source Routing Machine, free routing engine.
- **NWS** — US National Weather Service.
- **USGS** — US Geological Survey.

---

**End of plan v1.**
