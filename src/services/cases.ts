import { CATEGORY_CONFIG } from "@/lib/constants";
import { loadState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import { buildCaseStatusChangedEvent, inferZoneMode } from "@/lib/events/domain";
import type {
  CaseEvent,
  CaseEventAction,
  CaseEventActorType,
  CaseOwnerRole,
  DangerZone,
  HazardType,
  IncidentCase,
  IncidentCaseStatus,
  Report,
  RiskCluster,
} from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";
import type { CaseTriageResult } from "@/services/case-triage";

type CivicState = Awaited<ReturnType<typeof loadState>>;

const HAZARD_BY_CATEGORY: Partial<Record<Report["category"], HazardType>> = {
  fire_smoke: "fire_smoke",
  flooding: "flooding",
  weather_damage: "storm_weather",
  fallen_tree: "storm_weather",
  road_hazard: "road_blockage",
  pothole: "road_blockage",
  traffic_obstruction: "road_blockage",
  building_structure_concern: "infrastructure_damage",
  broken_streetlight: "infrastructure_damage",
  power_outage: "infrastructure_damage",
  public_disturbance: "public_disturbance",
  public_event_crowding: "crowd_risk",
  crowd_safety: "crowd_risk",
  school_area_concern: "school_area_concern",
  unauthorized_vending: "unauthorized_vending",
  trash_sanitation: "sanitation",
};

function categoryToHazardType(category: Report["category"]) {
  return HAZARD_BY_CATEGORY[category] || "other";
}

function ownerRoleFromRecommendedOwner(owner: string | undefined): CaseOwnerRole {
  if (owner === "police" || owner === "fire_ems" || owner === "public_works" || owner === "sanitation" || owner === "campus_safety") {
    return "responder";
  }
  if (owner === "government" || owner === "moderator" || owner === "responder") return owner;
  return "moderator";
}

function ownerDepartmentFromRecommendedOwner(owner: string | undefined): CaseOwnerRole | null {
  if (owner === "police" || owner === "fire_ems" || owner === "public_works" || owner === "sanitation" || owner === "campus_safety") return owner;
  return null;
}

function polygonAround(lat: number, lng: number, radius = 0.0018) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lng - radius, lat - radius * 0.55],
        [lng - radius * 0.2, lat + radius],
        [lng + radius, lat + radius * 0.42],
        [lng + radius * 0.72, lat - radius],
        [lng - radius, lat - radius * 0.55],
      ],
    ],
  };
}

export function addCaseEventInState(
  state: CivicState,
  input: {
    case_id: string;
    actor_type: CaseEventActorType;
    actor_label?: string | null;
    action: CaseEventAction;
    summary: string;
    metadata?: Record<string, unknown>;
  },
) {
  const event: CaseEvent = {
    id: createId(),
    case_id: input.case_id,
    actor_type: input.actor_type,
    actor_label: input.actor_label || null,
    action: input.action,
    summary: input.summary,
    metadata: input.metadata || {},
    created_at: nowIso(),
  };
  state.case_events.push(event);
  bus.emit({ type: "case.event_added", case_id: input.case_id, event });
  return event;
}

function buildCaseFromReport(report: Report, triage?: CaseTriageResult | null): IncidentCase {
  const hazardType = triage?.hazardType || report.hazard_type || categoryToHazardType(report.category);
  const title = triage?.suggestedTitle || report.ai_suggested_title || report.title;
  const activeZone = report.user_submitted_zone || report.ai_suggested_zone || polygonAround(report.latitude, report.longitude);

  return {
    id: createId(),
    title,
    original_title: report.original_title || report.title,
    ai_suggested_title: triage?.suggestedTitle || report.ai_suggested_title || null,
    linked_report_ids: [report.id],
    linked_cluster_id: report.cluster_id,
    hazard_type: hazardType,
    severity: triage?.severity ?? report.severity_score ?? report.risk_score,
    confidence: triage?.confidence ?? report.confidence_score,
    urgency: triage?.urgency ?? report.urgency_score ?? report.risk_score,
    privacy_risk: triage?.privacyRisk ?? report.privacy_risk_score ?? 0,
    evidence_match: triage?.evidenceMatch ?? report.evidence_match_score ?? 0,
    duplicate_likelihood: triage?.duplicateLikelihood ?? 0,
    status: triage?.requiredHumanReview ? "human_review" : "triage",
    owner_role: ownerRoleFromRecommendedOwner(triage?.recommendedOwner),
    owner_department: ownerDepartmentFromRecommendedOwner(triage?.recommendedOwner),
    active_zone: activeZone,
    predicted_zones: report.ai_suggested_zone ? [report.ai_suggested_zone] : [],
    public_summary: triage?.publicSummary || report.analysis_summary || "Case created from a citizen-submitted civic hazard report.",
    responder_summary: triage?.responderSummary || report.description,
    ai_reasoning_summary: triage?.reasoningSummary || report.analysis_json.score_breakdown.risk_reason,
    public_alert_status: "none",
    uipath_case_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function buildCaseFromCluster(state: CivicState, cluster: RiskCluster): IncidentCase {
  const reports = state.reports.filter((report) => report.cluster_id === cluster.id);
  const firstReport = reports[0] || null;
  const hazardType = cluster.hazard_type || categoryToHazardType(cluster.category);

  return {
    id: createId(),
    title: cluster.title,
    original_title: firstReport?.title || null,
    ai_suggested_title: `Possible ${CATEGORY_CONFIG[cluster.category].label.toLowerCase()} case`,
    linked_report_ids: reports.map((report) => report.id),
    linked_cluster_id: cluster.id,
    hazard_type: hazardType,
    severity: cluster.risk_score,
    confidence: cluster.confidence_score,
    urgency: cluster.risk_score,
    privacy_risk: cluster.category === "public_disturbance" || cluster.category === "school_area_concern" ? 60 : 18,
    evidence_match: Math.min(100, 35 + cluster.report_count * 14 + cluster.signal_count * 16 + cluster.photo_count * 10),
    duplicate_likelihood: cluster.report_count > 1 ? 55 : 15,
    status: cluster.risk_score >= 75 ? "assigned" : "triage",
    owner_role: cluster.risk_score >= 75 ? "government" : "moderator",
    owner_department:
      hazardType === "fire_smoke"
        ? "fire_ems"
        : hazardType === "road_blockage" || hazardType === "infrastructure_damage" || hazardType === "flooding"
          ? "public_works"
          : hazardType === "sanitation"
            ? "sanitation"
            : null,
    active_zone: cluster.zone_geometry || polygonAround(cluster.latitude, cluster.longitude),
    predicted_zones: [],
    public_summary: cluster.summary || "Case created from a related evidence cluster.",
    responder_summary: cluster.action_plan || "Review linked evidence and update the case workflow.",
    ai_reasoning_summary: cluster.analysis_json.score_breakdown.risk_reason,
    public_alert_status: "none",
    uipath_case_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

export function createIncidentCaseFromReportInState(state: CivicState, report: Report, triage?: CaseTriageResult | null) {
  if (report.linked_case_id) {
    return state.incident_cases.find((item) => item.id === report.linked_case_id) || null;
  }
  const incident = buildCaseFromReport(report, triage);
  state.incident_cases.push(incident);
  bus.emit({ type: "case.created", case: incident });
  report.linked_case_id = incident.id;
  report.hazard_type = incident.hazard_type;
  if (report.cluster_id) {
    const cluster = state.risk_clusters.find((item) => item.id === report.cluster_id);
    if (cluster) cluster.linked_case_id = incident.id;
  }
  addCaseEventInState(state, {
    case_id: incident.id,
    actor_type: "citizen",
    action: "report_submitted",
    summary: "Citizen report created the initial CaseOps evidence record.",
    metadata: { report_id: report.id },
  });
  addCaseEventInState(state, {
    case_id: incident.id,
    actor_type: "ai",
    action: "ai_triage_completed",
    summary: incident.ai_reasoning_summary,
    metadata: { severity: incident.severity, confidence: incident.confidence, privacy_risk: incident.privacy_risk },
  });
  return incident;
}

export function createIncidentCaseFromClusterInState(state: CivicState, cluster: RiskCluster) {
  if (cluster.linked_case_id) {
    return state.incident_cases.find((item) => item.id === cluster.linked_case_id) || null;
  }
  const incident = buildCaseFromCluster(state, cluster);
  state.incident_cases.push(incident);
  bus.emit({ type: "case.created", case: incident });
  cluster.linked_case_id = incident.id;
  for (const report of state.reports) {
    if (report.cluster_id === cluster.id) report.linked_case_id = incident.id;
  }
  for (const signal of state.public_signals) {
    if (signal.cluster_id === cluster.id) signal.linked_case_id = incident.id;
  }
  addCaseEventInState(state, {
    case_id: incident.id,
    actor_type: "moderator",
    action: "case_created",
    summary: "Moderator created a managed case from a related evidence cluster.",
    metadata: { cluster_id: cluster.id, report_count: incident.linked_report_ids.length },
  });
  return incident;
}

export async function getIncidentCases(params?: { include_private?: boolean; status?: IncidentCaseStatus | "all" }) {
  const state = await loadState();
  let items = state.incident_cases;
  if (params?.status && params.status !== "all") items = items.filter((item) => item.status === params.status);
  if (!params?.include_private) {
    items = items.filter((item) => !["rejected", "false_alarm", "duplicate"].includes(item.status));
  }
  return [...items].sort((a, b) => b.severity - a.severity || +new Date(b.updated_at) - +new Date(a.updated_at));
}

export async function getIncidentCaseById(id: string) {
  const state = await loadState();
  return state.incident_cases.find((item) => item.id === id) || null;
}

export async function getCaseEvents(case_id: string) {
  const state = await loadState();
  return state.case_events
    .filter((event) => event.case_id === case_id)
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

export async function getAllCaseEvents() {
  const state = await loadState();
  return [...state.case_events].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
}

export async function createIncidentCaseFromReport(report_id: string) {
  return withMutableState((state) => {
    const report = state.reports.find((item) => item.id === report_id);
    if (!report) throw new Error("Report not found.");
    const incident = createIncidentCaseFromReportInState(state, report);
    if (!incident) throw new Error("Unable to create case.");
    return incident;
  });
}

export async function createIncidentCaseFromCluster(cluster_id: string) {
  return withMutableState((state) => {
    const cluster = state.risk_clusters.find((item) => item.id === cluster_id);
    if (!cluster) throw new Error("Cluster not found.");
    const incident = createIncidentCaseFromClusterInState(state, cluster);
    if (!incident) throw new Error("Unable to create case.");
    return incident;
  });
}

export async function attachReportToCase(case_id: string, report_id: string) {
  return withMutableState((state) => {
    const incident = state.incident_cases.find((item) => item.id === case_id);
    const report = state.reports.find((item) => item.id === report_id);
    if (!incident || !report) throw new Error("Case or report not found.");
    if (!incident.linked_report_ids.includes(report.id)) incident.linked_report_ids.push(report.id);
    report.linked_case_id = incident.id;
    incident.updated_at = nowIso();
    addCaseEventInState(state, {
      case_id: incident.id,
      actor_type: "moderator",
      action: "report_attached_to_case",
      summary: `Report "${report.title}" attached to case.`,
      metadata: { report_id },
    });
    return incident;
  });
}

export async function updateIncidentCaseStatus(
  case_id: string,
  status: IncidentCaseStatus,
  actor_type: CaseEventActorType = "system",
  summary?: string,
) {
  return withMutableState((state) => {
    const incident = state.incident_cases.find((item) => item.id === case_id);
    if (!incident) throw new Error("Case not found.");
    const previousStatus = incident.status;
    incident.status = status;
    incident.updated_at = nowIso();
    const action: CaseEventAction =
      status === "resolved"
        ? "resolved"
        : status === "false_alarm"
          ? "false_alarm"
          : status === "rejected"
            ? "rejected"
            : status === "field_verification"
              ? "responder_accepted"
              : status === "active_response"
                ? "field_verified"
                : status === "escalated"
                  ? "escalated"
                  : "uipath_sync_event";
    addCaseEventInState(state, {
      case_id: incident.id,
      actor_type,
      action,
      summary: summary || `Case status changed to ${status}.`,
      metadata: { status },
    });
    if (previousStatus !== status) {
      bus.emit(buildCaseStatusChangedEvent(case_id, previousStatus, status));
    }
    return incident;
  });
}

export async function publishCasePublicAlert(
  case_id: string,
  status: IncidentCase["public_alert_status"],
  summary?: string,
  actor_type: CaseEventActorType = "government",
) {
  return withMutableState((state) => {
    const incident = state.incident_cases.find((item) => item.id === case_id);
    if (!incident) throw new Error("Case not found.");
    const previousStatus = incident.status;
    incident.public_alert_status = status;
    if (status === "active") incident.status = "public_alert_active";
    if (status === "pending_approval") incident.status = "public_alert_pending";
    if (status === "closed" && incident.status === "public_alert_active") incident.status = "monitoring";
    incident.updated_at = nowIso();
    addCaseEventInState(state, {
      case_id: incident.id,
      actor_type,
      action: status === "active" ? "public_alert_approved" : "public_alert_drafted",
      summary: summary || `Public alert status changed to ${status}.`,
      metadata: { public_alert_status: status },
    });
    if (previousStatus !== incident.status) {
      bus.emit(buildCaseStatusChangedEvent(case_id, previousStatus, incident.status));
    }
    return incident;
  });
}

export async function assignIncidentCase(case_id: string, owner_role: CaseOwnerRole, owner_department?: CaseOwnerRole | null) {
  return withMutableState((state) => {
    const incident = state.incident_cases.find((item) => item.id === case_id);
    if (!incident) throw new Error("Case not found.");
    const previousStatus = incident.status;
    incident.owner_role = owner_role;
    incident.owner_department = owner_department ?? incident.owner_department;
    incident.status = "assigned";
    incident.updated_at = nowIso();
    addCaseEventInState(state, {
      case_id: incident.id,
      actor_type: "moderator",
      action: "assigned_to_owner",
      summary: `Case assigned to ${owner_department || owner_role}.`,
      metadata: { owner_role, owner_department },
    });
    if (previousStatus !== incident.status) {
      bus.emit(buildCaseStatusChangedEvent(case_id, previousStatus, incident.status));
    }
    return incident;
  });
}

export async function addCaseEvent(input: Parameters<typeof addCaseEventInState>[1]) {
  return withMutableState((state) => addCaseEventInState(state, input));
}

export function createDangerZoneForCaseInState(
  state: CivicState,
  input: Omit<DangerZone, "id" | "created_at" | "updated_at">,
) {
  const now = nowIso();
  const zone: DangerZone = {
    ...input,
    id: createId(),
    created_at: now,
    updated_at: now,
  };
  state.danger_zones.push(zone);
  bus.emit({ type: "zone.computed", zone, mode: inferZoneMode(zone) });
  if (zone.case_id) {
    const incident = state.incident_cases.find((item) => item.id === zone.case_id);
    if (incident) {
      if (zone.type === "official_active_zone") incident.active_zone = zone.geometry;
      if (zone.type === "official_predicted_zone") incident.predicted_zones = [...incident.predicted_zones, zone.geometry];
      incident.updated_at = now;
      addCaseEventInState(state, {
        case_id: incident.id,
        actor_type: "government",
        action: zone.type === "official_predicted_zone" ? "predicted_zone_changed" : "danger_zone_changed",
        summary: `${zone.label} published as ${zone.type.replace(/_/g, " ")}.`,
        metadata: { zone_id: zone.id, zone_type: zone.type },
      });
    }
  }
  return zone;
}
