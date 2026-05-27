import type { CaseEvent, DangerZone, IncidentCase, PublicSignal, Report, RiskCluster } from "@/lib/types";

export type ClassificationResult = {
  extracted_location_text?: string | null;
  source_confidence?: number;
  risk_reason?: string | null;
  [key: string]: unknown;
};

export type AiTraceEvent = {
  id: string;
  [key: string]: unknown;
};

export type ZoneEventMode = "auto" | "predicted" | "ai_suggested" | "manual";

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
  | { type: "zone.computed"; zone: DangerZone; mode: ZoneEventMode }
  | { type: "zone.approved"; zone_id: string }
  | { type: "ai.trace"; trace: AiTraceEvent }
  | { type: "feed.scanned"; feed_id: string; items_added: number };

export const EVENT_NAMES = [
  "report.created",
  "report.scored",
  "report.clustered",
  "cluster.updated",
  "cluster.merged",
  "case.created",
  "case.event_added",
  "case.status_changed",
  "signal.ingested",
  "signal.classified",
  "zone.computed",
  "zone.approved",
  "ai.trace",
  "feed.scanned",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
