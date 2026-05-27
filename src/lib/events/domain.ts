import type { DangerZone, PublicSignal, Report } from "@/lib/types";
import type { CivicEvent, ZoneEventMode } from "@/lib/events/types";

export function buildReportLifecycleEvents(report: Report, matchReason?: "spatial" | "semantic" | "both") {
  const events: CivicEvent[] = [
    { type: "report.created", report },
    {
      type: "report.scored",
      report_id: report.id,
      risk_score: report.risk_score,
      confidence_score: report.confidence_score,
    },
  ];

  if (report.cluster_id && matchReason) {
    events.push({
      type: "report.clustered",
      report_id: report.id,
      cluster_id: report.cluster_id,
      match_reason: matchReason,
    });
  }

  return events;
}

export function buildSignalLifecycleEvents(signal: PublicSignal) {
  return [
    {
      type: "signal.ingested",
      signal,
      source: signal.source_type,
    },
    {
      type: "signal.classified",
      signal_id: signal.id,
      result: {
        extracted_location_text: signal.analysis_json.extracted_location_text ?? null,
        source_confidence: signal.analysis_json.source_confidence ?? undefined,
        risk_reason: signal.analysis_summary,
      },
    },
  ] satisfies CivicEvent[];
}

export function inferZoneMode(zone: DangerZone): ZoneEventMode {
  if (zone.type === "official_predicted_zone") return "predicted";
  if (zone.type === "ai_suggested_zone") return "ai_suggested";
  return "manual";
}

export function buildCaseStatusChangedEvent(case_id: string, from: string, to: string) {
  return {
    type: "case.status_changed",
    case_id,
    from,
    to,
  } satisfies CivicEvent;
}
