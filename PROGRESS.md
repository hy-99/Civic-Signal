## Unit A

Implemented the real-time event foundation for CivicSignal: a process-local event bus, SSE helpers, `/api/events/stream`, client event-stream utilities, and live refresh wiring on the map command center. Existing report, signal, cluster, case, and zone mutation paths now emit stream events. This is a partial completion of Unit A because the dashboard currently reacts by debounced `router.refresh()` rather than fully reconciling records in-place, and the stream route currently enforces `types` filtering only.

## Unit D

Implemented the scheduler shell from the real current app surface rather than the plan's missing `admin/page.tsx`: there is now an in-memory queue, job runner, jobs registry, `/api/cron/[task]`, workers for feed scan, cluster decay, zone recompute, and AI re-triage, plus an admin jobs panel on the source-feeds page. This is a pragmatic partial of Unit D because auth falls back to an admin session in demo mode when `CRON_SECRET` is unset, and the zone / re-triage workers currently operate on the project's existing case and zone models rather than the later planned Unit E / F data shapes.

## Unit B

Replaced the source-feed mock scanner with live ingestion for USGS GeoJSON, NWS active alerts, Weather.gov RSS, and Open-Meteo current conditions. Feed scans now send the required `CivicSignal/1.0` user agent, use live HTTP fetches with timeouts, preview real remote items, deduplicate persisted signals by `(source_feed_id, external_id)`, emit `feed.scanned`, and seed real demo-mode feeds while deactivating the legacy `example.org` mocks. This is still a pragmatic partial of Unit B because the RSS parser is a lightweight in-repo XML parser instead of `rss-parser`, and the category mapping remains heuristic against the current CivicSignal category set.

## Unit C

Implemented the semantic-clustering core: reports, public signals, and clusters now carry `embedding` vectors; embeddings are cached through `ai_cache`; new report and signal creation generate embeddings; clusters maintain an averaged embedding on recalculation; and cluster matching now combines spatial, temporal, and semantic scoring instead of pure radius matching. The report path now emits `report.clustered` with semantic match reasons and writes audit-log entries like `Matched via semantic similarity 0.59 ...` when semantic similarity drives the link. This is still a pragmatic partial of Unit C because the fallback embedding path is a deterministic lexical/concept embedding rather than a true Gemini semantic vector, existing seeded demo data is not pre-embedded up front, and the persistence layer currently uses `double precision[]` columns rather than pgvector.

## Unit E

Implemented a backend-first auto-zone pass: danger zones now carry `mode`, `parent_cluster_id`, `approved_at`, and `approved_by`; zone recompute generates or updates computed `official_active_zone` and `official_predicted_zone` overlays from linked cluster evidence instead of only redrawing existing polygons; and public zone reads now require approval while moderator/admin views still include pending zones. Demo mode auto-approves computed zones by default, with an `AUTO_APPROVE_ZONES` override and a new `/api/zones/[id]/approve` endpoint for non-demo approval. This is still a pragmatic partial of Unit E because the admin approval UI, merge/reject controls, and AI-suggested zone geometry are not implemented yet.
