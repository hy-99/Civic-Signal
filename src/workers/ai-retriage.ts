import { withMutableState } from "@/lib/data-store";
import type { CivicState, IncidentCaseStatus } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { addCaseEventInState } from "@/services/cases";
import { triageReportForCaseOps } from "@/services/case-triage";

const CLOSED_CASE_STATUSES = new Set<IncidentCaseStatus>(["resolved", "false_alarm", "rejected", "duplicate"]);

export async function rerunCaseTriageInState(state: CivicState, options?: { stale_hours?: number }) {
  const staleHours = options?.stale_hours ?? 6;
  let updated = 0;
  let skipped = 0;

  for (const incident of state.incident_cases) {
    if (CLOSED_CASE_STATUSES.has(incident.status)) {
      skipped += 1;
      continue;
    }

    const ageHours = (Date.now() - new Date(incident.updated_at).getTime()) / 3_600_000;
    if (ageHours < staleHours) {
      skipped += 1;
      continue;
    }

    const primaryReport = state.reports.find((report) => incident.linked_report_ids.includes(report.id));
    if (!primaryReport) {
      skipped += 1;
      continue;
    }

    const signalCount = incident.linked_cluster_id
      ? state.public_signals.filter((signal) => signal.cluster_id === incident.linked_cluster_id).length
      : 0;
    const nearbyCount = Math.max(0, incident.linked_report_ids.length - 1);
    const triage = await triageReportForCaseOps({
      title: primaryReport.title,
      description: primaryReport.description,
      category: primaryReport.category,
      urgency: primaryReport.urgency,
      address_text: primaryReport.address_text,
      image_analysis: primaryReport.analysis_json.image_analysis,
      nearby_report_count: nearbyCount,
      official_signal_count: signalCount,
    });

    incident.title = triage.suggestedTitle || incident.title;
    incident.hazard_type = triage.hazardType;
    incident.severity = triage.severity;
    incident.confidence = triage.confidence;
    incident.urgency = triage.urgency;
    incident.privacy_risk = triage.privacyRisk;
    incident.evidence_match = triage.evidenceMatch;
    incident.duplicate_likelihood = triage.duplicateLikelihood;
    incident.public_summary = triage.publicSummary;
    incident.responder_summary = triage.responderSummary;
    incident.ai_reasoning_summary = triage.reasoningSummary;
    incident.updated_at = nowIso();

    addCaseEventInState(state, {
      case_id: incident.id,
      actor_type: "ai",
      actor_label: "Scheduler re-triage",
      action: "ai_triage_completed",
      summary: `Scheduler re-ran triage. ${triage.reasoningSummary}`,
      metadata: {
        severity: triage.severity,
        confidence: triage.confidence,
        privacy_risk: triage.privacyRisk,
        retriaged: true,
      },
    });
    updated += 1;
  }

  return {
    processed: state.incident_cases.length,
    updated,
    skipped,
  };
}

export async function runAiRetriageJob(options?: { stale_hours?: number }) {
  return withMutableState((state) => rerunCaseTriageInState(state, options));
}
