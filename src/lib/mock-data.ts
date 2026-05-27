import { CATEGORY_CONFIG, DEMO_PERSONAS, DEFAULT_COORDS } from "@/lib/constants";
import type {
  AnalysisJson,
  CaseEvent,
  CivicState,
  ConfidenceLabel,
  DangerZone,
  HazardType,
  IncidentCase,
  PublicSignal,
  Report,
  ReportCategoryKey,
  RiskCluster,
  RiskClusterStatus,
  RiskLevel,
  ScoreFactor,
  SourceType,
} from "@/lib/types";

const now = new Date();
const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

type DemoArea = {
  label: string;
  lat: number;
  lng: number;
  kind: "school" | "transit" | "park" | "library" | "waterfront" | "commercial" | "residential" | "event" | "road";
  templateIndex?: number;
};

type SituationTemplate = {
  title: string | ((area: DemoArea) => string);
  description: string | ((area: DemoArea) => string);
  summary: string | ((area: DemoArea) => string);
  category: ReportCategoryKey;
  urgency: RiskLevel;
  status: RiskClusterStatus;
  risk_score: number;
  confidence_score: number;
  source_type?: SourceType;
  source_title?: string | ((area: DemoArea) => string);
  source_text?: string | ((area: DemoArea) => string);
  action: string | ((area: DemoArea) => string);
  risk_reason: string | ((area: DemoArea) => string);
  confidence_reason: string | ((area: DemoArea) => string);
};

const DEMO_AREAS: DemoArea[] = [
  { label: "Embarcadero Ferry walkway", lat: 37.7955, lng: -122.3938, kind: "waterfront", templateIndex: 6 },
  { label: "Mission St near 24th transit stop", lat: 37.7522, lng: -122.4185, kind: "transit", templateIndex: 1 },
  { label: "Castro & Market crosswalk", lat: 37.7627, lng: -122.435, kind: "road", templateIndex: 4 },
  { label: "Dolores Park north entrance", lat: 37.7610, lng: -122.4267, kind: "park", templateIndex: 3 },
  { label: "Geary Blvd & 22nd Ave", lat: 37.7806, lng: -122.4664, kind: "road", templateIndex: 15 },
];

const SITUATION_TEMPLATES: SituationTemplate[] = [
  {
    title: "Possible vape sales reported near school walkway",
    description:
      "Several students mentioned possible vape sales near the public walkway after dismissal. No person is identified and this needs verification.",
    summary: "Possible school-area concern reported near a public walkway. No private person is identified.",
    category: "school_area_concern",
    urgency: "watch",
    status: "monitoring",
    risk_score: 47,
    confidence_score: 58,
    source_type: "manual",
    source_title: "Dismissal walkway monitoring requested",
    source_text: "Community volunteers requested extra monitoring around a school-area public walkway after dismissal.",
    action: "Verify the place-based condition and keep private-person claims out of public summaries.",
    risk_reason: "Risk is Watch because the report involves a school-area walkway and needs verification before any stronger claim.",
    confidence_reason: "Confidence is Medium because the location is specific, but official corroboration is not yet present.",
  },
  {
    title: "Reported public fight near transit stop",
    description:
      "A public conflict was reported near the transit stop. The area appeared to clear, but riders were avoiding part of the platform.",
    summary: "Reported public disturbance near a transit stop. Evidence is place-based and still needs corroboration.",
    category: "public_disturbance",
    urgency: "serious",
    status: "active",
    risk_score: 67,
    confidence_score: 60,
    source_type: "traffic",
    source_title: "Short boarding delay near transit stop",
    source_text: "Transit operators noted a short boarding delay near the platform because of public-space activity.",
    action: "Monitor the transit stop and mark resolved if platform access remains clear.",
    risk_reason: "Risk is Serious because a reported public fight can affect transit access and public-space safety.",
    confidence_reason: "Confidence is Medium because the report is recent and specific but has limited corroboration.",
  },
  {
    title: "Crowd blocking library entrance after event",
    description:
      "A large crowd is spilling across the entrance and sidewalk after the community event, making it hard for families to enter safely.",
    summary: "Crowd congestion reported and confirmed near the library entrance after an event.",
    category: "crowd_safety",
    urgency: "watch",
    status: "monitoring",
    risk_score: 49,
    confidence_score: 78,
    source_type: "city_alert",
    source_title: "Event exit guidance posted",
    source_text: "Event staff asked attendees to keep the entrance and accessible path clear during departure.",
    action: "Keep entry paths open and confirm when the crowd disperses.",
    risk_reason: "Risk is Watch because crowding is blocking an entrance and could worsen if the event continues.",
    confidence_reason: "Confidence is High because the location is specific and a public event signal supports it.",
  },
  {
    title: "Broken glass near playground path",
    description: "Broken glass is scattered on the public path next to the playground gate. Several families walked around it.",
    summary: "Verified path hazard near a playground gate. Cleanup should be prioritized before peak use.",
    category: "unsafe_sidewalk",
    urgency: "watch",
    status: "active",
    risk_score: 45,
    confidence_score: 82,
    source_type: "city_alert",
    source_title: "Cleanup request received",
    source_text: "A cleanup request was logged for debris near a playground path.",
    action: "Route to cleanup and mark resolved once the path is safe.",
    risk_reason: "Risk is Watch because broken glass affects a pedestrian path near a playground.",
    confidence_reason: "Confidence is High because the location is specific and community verification supports it.",
  },
  {
    title: "Aggressive driving near school pickup zone",
    description: "Multiple cars were reported speeding through the pickup zone and ignoring temporary crossing cones during dismissal.",
    summary: "Reported driving hazard near a school pickup zone. Needs additional observation or official traffic support.",
    category: "road_hazard",
    urgency: "serious",
    status: "active",
    risk_score: 63,
    confidence_score: 62,
    source_type: "traffic",
    source_title: "Pickup-zone traffic watch",
    source_text: "A traffic watch note flagged congestion around a school pickup route.",
    action: "Request verification during the next pickup period and monitor traffic flow.",
    risk_reason: "Risk is Serious because aggressive driving near a school pickup zone can affect pedestrians.",
    confidence_reason: "Confidence is Medium because the report is detailed but still has limited corroboration.",
  },
  {
    title: "Water pooling near River Ave crosswalk",
    description: "Water is pooling along the curb and partially covering the crosswalk after afternoon rain.",
    summary: "Reported crosswalk flooding with related weather context.",
    category: "flooding",
    urgency: "serious",
    status: "active",
    risk_score: 69,
    confidence_score: 76,
    source_type: "weather",
    source_title: "Rain advisory for low crossings",
    source_text: "Low curb crossings may collect water during evening rain.",
    action: "Monitor for pedestrian impacts and update when the crossing clears.",
    risk_reason: "Risk is Serious because water is affecting a pedestrian crossing and rain is ongoing.",
    confidence_reason: "Confidence is High because a related weather signal supports the report.",
  },
  {
    title: (area) => `Smoke smell reported near ${area.label}`,
    description: (area) => `Light smoke odor was reported near ${area.label}. No flames were confirmed, and the source needs verification.`,
    summary: (area) => `Possible smoke condition near ${area.label}. Official confirmation has not been found.`,
    category: "fire_smoke",
    urgency: "urgent",
    status: "active",
    risk_score: 82,
    confidence_score: 55,
    source_type: "weather",
    source_title: "Dry wind advisory context",
    source_text: "Dry wind conditions may increase sensitivity to smoke reports near open areas.",
    action: "Ask nearby users to verify from a safe distance and check official local alerts.",
    risk_reason: "Risk is Urgent because smoke-related reports can indicate fast-changing conditions.",
    confidence_reason: "Confidence is Medium because there is a specific report, but no official confirmation yet.",
  },
  {
    title: (area) => `Streetlight outage reported near ${area.label}`,
    description: (area) => `A streetlight has reportedly been out for several evenings near ${area.label}, making the crossing feel less visible.`,
    summary: (area) => `Repeated streetlight outage report near ${area.label}.`,
    category: "broken_streetlight",
    urgency: "watch",
    status: "active",
    risk_score: 35,
    confidence_score: 72,
    source_type: "city_alert",
    source_title: "Lighting maintenance ticket open",
    source_text: "A lighting maintenance ticket is open for the area.",
    action: "Route to lighting maintenance and mark resolved after nighttime confirmation.",
    risk_reason: "Risk is Watch because lighting affects visibility at pedestrian routes.",
    confidence_reason: "Confidence is High because the issue is repeated and location-specific.",
  },
  {
    title: (area) => `Trash buildup near storm drain at ${area.label}`,
    description: (area) => `Trash and leaves are collecting around a storm drain near ${area.label}. It could worsen if rain continues.`,
    summary: (area) => `Drain blockage concern near ${area.label}.`,
    category: "trash_sanitation",
    urgency: "watch",
    status: "monitoring",
    risk_score: 39,
    confidence_score: 68,
    source_type: "weather",
    source_title: "Light rain expected tonight",
    source_text: "Light rain may make blocked drains more noticeable overnight.",
    action: "Route to sanitation or public works before the next rain window.",
    risk_reason: "Risk is Watch because drain blockage can contribute to localized pooling.",
    confidence_reason: "Confidence is Medium because the report is specific but still needs cleanup confirmation.",
  },
  {
    title: (area) => `Large pothole reported near ${area.label}`,
    description: (area) => `Drivers were swerving around a large pothole near ${area.label}. No crash was reported.`,
    summary: (area) => `Road surface hazard reported near ${area.label}.`,
    category: "pothole",
    urgency: "watch",
    status: "active",
    risk_score: 44,
    confidence_score: 64,
    source_type: "manual",
    source_title: "Road maintenance note",
    source_text: "Road surface concerns have been logged nearby.",
    action: "Collect confirmations and route to road maintenance.",
    risk_reason: "Risk is Watch because road surface damage can affect vehicles and cyclists.",
    confidence_reason: "Confidence is Medium because the report is specific but has limited corroboration.",
  },
  {
    title: (area) => `Fallen branch blocking sidewalk near ${area.label}`,
    description: (area) => `A fallen branch is blocking part of the sidewalk near ${area.label}, forcing pedestrians around it.`,
    summary: (area) => `Sidewalk obstruction from a fallen branch near ${area.label}.`,
    category: "fallen_tree",
    urgency: "serious",
    status: "active",
    risk_score: 61,
    confidence_score: 74,
    source_type: "city_alert",
    source_title: "Tree crew queue updated",
    source_text: "Tree crew dispatch queue includes wind-related branch reports.",
    action: "Route to tree maintenance and confirm when the path is clear.",
    risk_reason: "Risk is Serious because pedestrians may need to step around the obstruction.",
    confidence_reason: "Confidence is High because the condition is specific and supported by maintenance context.",
  },
  {
    title: (area) => `Possible unpermitted vending near ${area.label}`,
    description: (area) => `Possible unpermitted vending was reported near ${area.label}. The report does not identify any private person and needs verification.`,
    summary: (area) => `Possible unauthorized vending concern near ${area.label}; needs careful verification.`,
    category: "unauthorized_vending",
    urgency: "watch",
    status: "monitoring",
    risk_score: 38,
    confidence_score: 52,
    source_type: "manual",
    source_title: "Public-space monitoring note",
    source_text: "A public-space monitoring note requested neutral verification near the area.",
    action: "Verify only the place-based condition and avoid private-person claims.",
    risk_reason: "Risk is Watch because the report concerns a public area and needs neutral verification.",
    confidence_reason: "Confidence is Medium-low because the issue has not been corroborated by an official source.",
  },
  {
    title: (area) => `Crowd queue spilling into path near ${area.label}`,
    description: (area) => `A queue is spilling into the public path near ${area.label}, creating a pinch point for pedestrians and strollers.`,
    summary: (area) => `Crowd-safety pinch point near ${area.label}.`,
    category: "crowd_safety",
    urgency: "watch",
    status: "active",
    risk_score: 46,
    confidence_score: 80,
    source_type: "city_alert",
    source_title: "Event crowd guidance",
    source_text: "Organizers were reminded to keep public paths open.",
    action: "Ask organizers or moderators to keep the path clear.",
    risk_reason: "Risk is Watch because crowding is affecting normal access.",
    confidence_reason: "Confidence is High because the crowding is location-specific and time-bound.",
  },
  {
    title: (area) => `Power outage affecting signal near ${area.label}`,
    description: (area) => `A traffic signal or crossing indicator appears dark near ${area.label}. The outage needs confirmation.`,
    summary: (area) => `Possible signal-related outage near ${area.label}.`,
    category: "power_outage",
    urgency: "serious",
    status: "active",
    risk_score: 58,
    confidence_score: 63,
    source_type: "city_alert",
    source_title: "Utility maintenance notice",
    source_text: "Utility crews noted a localized maintenance issue nearby.",
    action: "Confirm the affected crossing and route to utility or signal maintenance.",
    risk_reason: "Risk is Serious because signal outages can affect crossing decisions.",
    confidence_reason: "Confidence is Medium because the report is specific but needs official confirmation.",
  },
  {
    title: (area) => `Structure debris concern near ${area.label}`,
    description: (area) => `Small pieces of facade debris were reported near the public walkway at ${area.label}. No injury was reported.`,
    summary: (area) => `Building or structure debris concern near ${area.label}.`,
    category: "building_structure_concern",
    urgency: "serious",
    status: "monitoring",
    risk_score: 64,
    confidence_score: 57,
    source_type: "manual",
    source_title: "Facilities review requested",
    source_text: "A facilities review was requested for a public walkway area.",
    action: "Keep the walkway clear and route to facilities review.",
    risk_reason: "Risk is Serious because falling debris can affect people using the sidewalk.",
    confidence_reason: "Confidence is Medium because details are specific but official inspection is pending.",
  },
  {
    title: (area) => `Road obstruction cleared near ${area.label}`,
    description: (area) => `Earlier debris in the road near ${area.label} appears to have been cleared, but users can confirm if it remains safe.`,
    summary: (area) => `Resolved road obstruction near ${area.label}.`,
    category: "traffic_obstruction",
    urgency: "low",
    status: "resolved",
    risk_score: 18,
    confidence_score: 84,
    source_type: "traffic",
    source_title: "Roadway reopened",
    source_text: "Traffic source indicates the route has reopened.",
    action: "Keep as resolved unless new reports indicate the obstruction returned.",
    risk_reason: "Risk is Low because the obstruction appears resolved.",
    confidence_reason: "Confidence is High because a traffic source supports resolution.",
  },
  {
    title: (area) => `Weather debris watch near ${area.label}`,
    description: (area) => `Small branches and wind-blown debris were reported near ${area.label}. The path is passable but should be watched.`,
    summary: (area) => `Weather-related debris watch near ${area.label}.`,
    category: "weather_damage",
    urgency: "watch",
    status: "monitoring",
    risk_score: 42,
    confidence_score: 69,
    source_type: "weather",
    source_title: "High wind advisory",
    source_text: "Wind advisory remains active for exposed routes.",
    action: "Monitor for worsening debris and mark resolved after cleanup.",
    risk_reason: "Risk is Watch because weather debris can worsen quickly.",
    confidence_reason: "Confidence is Medium because weather context supports the report.",
  },
  {
    title: (area) => `Low-risk accessibility note near ${area.label}`,
    description: (area) => `A temporary sign or cone placement near ${area.label} may be narrowing the walkway but is still passable.`,
    summary: (area) => `Low-risk accessibility note near ${area.label}.`,
    category: "unsafe_sidewalk",
    urgency: "low",
    status: "monitoring",
    risk_score: 22,
    confidence_score: 54,
    source_type: "manual",
    source_title: "Community access note",
    source_text: "A community member requested a light-touch accessibility check.",
    action: "Monitor and update only if the path becomes blocked.",
    risk_reason: "Risk is Low because the path is passable and no immediate safety issue is reported.",
    confidence_reason: "Confidence is Medium because the location is clear but impact is limited.",
  },
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pickText(value: string | ((area: DemoArea) => string), area: DemoArea) {
  return typeof value === "function" ? value(area) : value;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function factor(label: string, value: number, type: ScoreFactor["type"]): ScoreFactor {
  return { label, value, type };
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return "urgent";
  if (score >= 50) return "serious";
  if (score >= 25) return "watch";
  return "low";
}

function confidenceLabelFromScore(score: number): ConfidenceLabel {
  if (score >= 85) return "very_high";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "very_low";
}

function makeId(group: number, index: number) {
  return `00000000-0000-4000-8000-${String(group * 1_000_000 + index).padStart(12, "0")}`;
}

function jitterCoord(value: number, random: () => number, span = 0.0028) {
  return Number((value + (random() - 0.5) * span).toFixed(6));
}

function analysis(input: {
  category: ReportCategoryKey;
  risk_score: number;
  confidence_score: number;
  risk_reason: string;
  confidence_reason: string;
  recommended_action: string;
  moderation_flags?: AnalysisJson["moderation_flags"];
}): AnalysisJson {
  const config = CATEGORY_CONFIG[input.category];
  return {
    score_breakdown: {
      risk_score: input.risk_score,
      confidence_score: input.confidence_score,
      risk_level: riskLevelFromScore(input.risk_score),
      confidence_label: confidenceLabelFromScore(input.confidence_score),
      risk_factors: [
        factor(`${config.label} category`, config.base_severity, "base"),
        factor("Specific location", 8, "bonus"),
        factor("Recent report", 8, "bonus"),
      ],
      confidence_factors: [
        factor("Specific location", 20, "bonus"),
        factor("Direct observation details", 10, "bonus"),
        factor("Recent timestamp", 10, "bonus"),
      ],
      risk_reason: input.risk_reason,
      confidence_reason: input.confidence_reason,
      recommended_action: input.recommended_action,
    },
    moderation_flags: input.moderation_flags || [],
  };
}

function categoryToHazardType(category: ReportCategoryKey): HazardType {
  if (category === "fire_smoke") return "fire_smoke";
  if (category === "flooding") return "flooding";
  if (category === "weather_damage" || category === "fallen_tree") return "storm_weather";
  if (category === "pothole" || category === "traffic_obstruction" || category === "road_hazard") return "road_blockage";
  if (category === "building_structure_concern" || category === "broken_streetlight" || category === "power_outage") return "infrastructure_damage";
  if (category === "public_disturbance") return "public_disturbance";
  if (category === "crowd_safety" || category === "public_event_crowding") return "crowd_risk";
  if (category === "school_area_concern") return "school_area_concern";
  if (category === "unauthorized_vending") return "unauthorized_vending";
  if (category === "trash_sanitation") return "sanitation";
  return "other";
}

function polygonAround(lat: number, lng: number, radius = 0.0022, skew = 0.0009) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lng - radius, lat - radius * 0.55],
        [lng - skew, lat + radius],
        [lng + radius * 1.15, lat + radius * 0.35],
        [lng + radius * 0.8, lat - radius * 0.95],
        [lng - radius, lat - radius * 0.55],
      ],
    ],
  };
}

function lineNear(lat: number, lng: number, length = 0.005) {
  return {
    type: "LineString" as const,
    coordinates: [
      [lng - length * 0.5, lat - length * 0.18],
      [lng, lat],
      [lng + length * 0.55, lat + length * 0.22],
    ],
  };
}

function createSeedCaseOps(
  risk_clusters: RiskCluster[],
  reports: Report[],
  public_signals: PublicSignal[],
) {
  const incident_cases: IncidentCase[] = [];
  const danger_zones: DangerZone[] = [];
  const case_events: CaseEvent[] = [];
  const candidates = risk_clusters
    .filter((cluster) => cluster.risk_score >= 45 || cluster.category === "fire_smoke" || cluster.category === "flooding")
    .slice(0, 6);

  candidates.forEach((cluster, index) => {
    const linkedReports = reports.filter((report) => report.cluster_id === cluster.id).map((report) => report.id);
    const linkedSignals = public_signals.filter((signal) => signal.cluster_id === cluster.id).map((signal) => signal.id);
    const caseId = makeId(1000, index + 1);
    const zone = polygonAround(cluster.latitude, cluster.longitude, cluster.risk_level === "urgent" ? 0.003 : 0.002);
    const predictedZone = polygonAround(cluster.latitude + 0.0012, cluster.longitude + 0.0014, 0.0027, 0.0006);
    const status: IncidentCase["status"] =
      cluster.category === "fire_smoke"
        ? "public_alert_active"
        : cluster.status === "verified"
          ? "field_verification"
          : cluster.status === "in_progress"
            ? "active_response"
            : "triage";

    incident_cases.push({
      id: caseId,
      title: cluster.title,
      original_title: linkedReports.length ? reports.find((report) => report.id === linkedReports[0])?.title ?? null : null,
      ai_suggested_title: `Possible ${CATEGORY_CONFIG[cluster.category].label.toLowerCase()} near ${cluster.latitude.toFixed(3)}, ${cluster.longitude.toFixed(3)}`,
      linked_report_ids: linkedReports,
      linked_cluster_id: cluster.id,
      hazard_type: categoryToHazardType(cluster.category),
      severity: cluster.risk_score,
      confidence: cluster.confidence_score,
      urgency: cluster.risk_score,
      privacy_risk: cluster.category === "public_disturbance" || cluster.category === "school_area_concern" ? 64 : 22,
      evidence_match: Math.min(96, 45 + linkedReports.length * 15 + linkedSignals.length * 18 + cluster.photo_count * 10),
      duplicate_likelihood: linkedReports.length > 1 ? 56 : 18,
      status,
      owner_role: cluster.category === "fire_smoke" || cluster.category === "flooding" ? "government" : "responder",
      owner_department:
        cluster.category === "fire_smoke"
          ? "fire_ems"
          : cluster.category === "flooding" || cluster.category === "road_hazard" || cluster.category === "pothole"
            ? "public_works"
            : cluster.category === "trash_sanitation"
              ? "sanitation"
              : "police",
      active_zone: zone,
      predicted_zones: cluster.category === "fire_smoke" || cluster.category === "flooding" ? [predictedZone] : [],
      public_summary: cluster.summary || `Public report cluster for ${CATEGORY_CONFIG[cluster.category].label.toLowerCase()}.`,
      responder_summary: cluster.action_plan || "Review evidence, verify from a safe distance, and update status.",
      ai_reasoning_summary: cluster.analysis_json.score_breakdown.risk_reason,
      public_alert_status: cluster.category === "fire_smoke" ? "active" : "none",
      uipath_case_id: `mock-uipath-${String(index + 1).padStart(3, "0")}`,
      created_at: cluster.created_at,
      updated_at: cluster.updated_at,
    });

    cluster.linked_case_id = caseId;
    cluster.hazard_type = categoryToHazardType(cluster.category);
    cluster.zone_geometry = zone;
    reports.forEach((report) => {
      if (linkedReports.includes(report.id)) report.linked_case_id = caseId;
    });
    public_signals.forEach((signal) => {
      if (linkedSignals.includes(signal.id)) signal.linked_case_id = caseId;
    });

    danger_zones.push({
      id: makeId(1100, index + 1),
      case_id: caseId,
      report_id: null,
      cluster_id: cluster.id,
      parent_cluster_id: cluster.id,
      type: "official_active_zone",
      mode: "manual",
      geometry: zone,
      label: `${CATEGORY_CONFIG[cluster.category].label} active zone`,
      severity: cluster.risk_score,
      confidence: cluster.confidence_score,
      starts_at: cluster.created_at,
      expires_at: null,
      estimated_arrival_at: null,
      instructions: "Avoid the immediate area until the case is updated by a moderator or responder.",
      approved_at: cluster.created_at,
      approved_by: DEMO_PERSONAS[2].id,
      created_by_role: "government",
      created_at: cluster.created_at,
      updated_at: cluster.updated_at,
    });

    if (cluster.category === "fire_smoke" || cluster.category === "flooding") {
      danger_zones.push({
        id: makeId(1200, index + 1),
        case_id: caseId,
        report_id: null,
        cluster_id: cluster.id,
        parent_cluster_id: cluster.id,
        type: "official_predicted_zone",
        mode: "manual",
        geometry: predictedZone,
        label: `${CATEGORY_CONFIG[cluster.category].label} predicted spread`,
        severity: Math.max(35, cluster.risk_score - 12),
        confidence: Math.max(30, cluster.confidence_score - 16),
        starts_at: null,
        expires_at: null,
        estimated_arrival_at: ago(-1),
        instructions: "Monitor official updates. This is a predicted planning zone, not confirmed impact.",
        approved_at: cluster.created_at,
        approved_by: DEMO_PERSONAS[2].id,
        created_by_role: "government",
        created_at: cluster.created_at,
        updated_at: cluster.updated_at,
      });
    }

    if (index < 3) {
      danger_zones.push({
        id: makeId(1300, index + 1),
        case_id: caseId,
        report_id: null,
        cluster_id: cluster.id,
        parent_cluster_id: cluster.id,
        type: "evacuation_route",
        mode: "manual",
        geometry: lineNear(cluster.latitude - 0.002, cluster.longitude + 0.001),
        label: "Suggested safe route",
        severity: 10,
        confidence: 58,
        starts_at: null,
        expires_at: null,
        estimated_arrival_at: null,
        instructions: "Use this as a demo route for safe movement away from the hazard zone.",
        approved_at: cluster.created_at,
        approved_by: DEMO_PERSONAS[2].id,
        created_by_role: "government",
        created_at: cluster.created_at,
        updated_at: cluster.updated_at,
      });
    }

    case_events.push(
      {
        id: makeId(1400, index * 4 + 1),
        case_id: caseId,
        actor_type: "citizen",
        actor_label: "Community report",
        action: "report_submitted",
        summary: `${linkedReports.length || 1} citizen report${linkedReports.length === 1 ? "" : "s"} linked to this place-based hazard.`,
        metadata: { linked_report_ids: linkedReports },
        created_at: cluster.created_at,
      },
      {
        id: makeId(1400, index * 4 + 2),
        case_id: caseId,
        actor_type: "ai",
        actor_label: "Gemini triage fallback-ready",
        action: "ai_triage_completed",
        summary: `Severity ${cluster.risk_score}, confidence ${cluster.confidence_score}, category ${cluster.category}.`,
        metadata: { risk_level: cluster.risk_level, signal_ids: linkedSignals },
        created_at: ago(Math.max(0.5, index + 1)),
      },
      {
        id: makeId(1400, index * 4 + 3),
        case_id: caseId,
        actor_type: status === "triage" ? "moderator" : "government",
        actor_label: status === "triage" ? "Dispatcher review" : "Operations desk",
        action: status === "triage" ? "moderator_reviewed" : "public_alert_approved",
        summary: status === "triage" ? "Case is queued for human review." : "Public-safe case status is visible on the map.",
        metadata: { status },
        created_at: cluster.updated_at,
      },
    );
  });

  return { incident_cases, danger_zones, case_events };
}

function createProfiles() {
  return [
    {
      id: DEMO_PERSONAS[0].id,
      display_name: "Maya Rivera",
      username: "maya-rivera",
      role: "user" as const,
      trust_score: 74,
      home_city: "CivicSignal Bay Demo",
      avatar_url: null,
      created_at: ago(500),
      updated_at: ago(4),
      demo_email: DEMO_PERSONAS[0].email,
      demo_password: DEMO_PERSONAS[0].password,
    },
    {
      id: DEMO_PERSONAS[1].id,
      display_name: "Jordan Patel",
      username: "jordan-patel",
      role: "moderator" as const,
      trust_score: 88,
      home_city: "CivicSignal Bay Demo",
      avatar_url: null,
      created_at: ago(800),
      updated_at: ago(2),
      demo_email: DEMO_PERSONAS[1].email,
      demo_password: DEMO_PERSONAS[1].password,
    },
    {
      id: DEMO_PERSONAS[2].id,
      display_name: "Avery Chen",
      username: "avery-chen",
      role: "admin" as const,
      trust_score: 92,
      home_city: "CivicSignal Bay Demo",
      avatar_url: null,
      created_at: ago(900),
      updated_at: ago(1),
      demo_email: DEMO_PERSONAS[2].email,
      demo_password: DEMO_PERSONAS[2].password,
    },
  ];
}

function createSourceFeeds() {
  return [
    {
      id: "0d76bd3c-8191-48f2-8d7f-f2f2cc090001",
      name: "CivicSignal Bay City Alerts",
      url: "https://example.org/civicsignal-city-alerts.xml",
      source_type: "city_alert" as const,
      default_city: DEFAULT_COORDS.city,
      default_latitude: DEFAULT_COORDS.lat,
      default_longitude: DEFAULT_COORDS.lng,
      trust_level: 85,
      is_active: true,
      keywords: ["closure", "maintenance", "alert", "cleanup"],
      last_checked_at: ago(3),
      last_success_at: ago(3),
      last_error: null,
      created_at: ago(700),
      updated_at: ago(3),
    },
    {
      id: "0d76bd3c-8191-48f2-8d7f-f2f2cc090002",
      name: "School Area Safety Notices",
      url: "https://example.org/school-area-notices.xml",
      source_type: "manual" as SourceType,
      default_city: DEFAULT_COORDS.city,
      default_latitude: 37.7784,
      default_longitude: -122.4266,
      trust_level: 72,
      is_active: true,
      keywords: ["school", "pickup", "walkway", "dismissal"],
      last_checked_at: ago(5),
      last_success_at: ago(5),
      last_error: null,
      created_at: ago(700),
      updated_at: ago(5),
    },
    {
      id: "0d76bd3c-8191-48f2-8d7f-f2f2cc090003",
      name: "Transit Service Alerts",
      url: "https://example.org/transit-alerts.xml",
      source_type: "traffic" as const,
      default_city: DEFAULT_COORDS.city,
      default_latitude: 37.7764,
      default_longitude: -122.4188,
      trust_level: 78,
      is_active: true,
      keywords: ["delay", "transit", "platform", "stop"],
      last_checked_at: ago(2),
      last_success_at: ago(2),
      last_error: null,
      created_at: ago(700),
      updated_at: ago(2),
    },
    {
      id: "0d76bd3c-8191-48f2-8d7f-f2f2cc090004",
      name: "Weather and Utility Signals",
      url: "https://example.org/weather-utility.xml",
      source_type: "weather" as const,
      default_city: DEFAULT_COORDS.city,
      default_latitude: DEFAULT_COORDS.lat,
      default_longitude: DEFAULT_COORDS.lng,
      trust_level: 76,
      is_active: true,
      keywords: ["rain", "wind", "utility", "advisory"],
      last_checked_at: ago(4),
      last_success_at: ago(4),
      last_error: null,
      created_at: ago(700),
      updated_at: ago(4),
    },
  ];
}

function sourceFeedForType(source_type: SourceType, source_feeds: ReturnType<typeof createSourceFeeds>) {
  if (source_type === "traffic") return source_feeds[2];
  if (source_type === "weather") return source_feeds[3];
  if (source_type === "manual") return source_feeds[1];
  return source_feeds[0];
}

export function createInitialState(): CivicState {
  const random = seededRandom(20260429);
  const profiles = createProfiles();
  const source_feeds = createSourceFeeds();
  const reports: Report[] = [];
  const public_signals: PublicSignal[] = [];
  const risk_clusters: RiskCluster[] = [];
  const report_votes: CivicState["report_votes"] = [];
  const cluster_votes: CivicState["cluster_votes"] = [];

  DEMO_AREAS.forEach((area, index) => {
    const templateIdx = area.templateIndex ?? index;
    const template = SITUATION_TEMPLATES[templateIdx] || SITUATION_TEMPLATES[(index * 7 + 3) % SITUATION_TEMPLATES.length];
    const clusterIndex = index + 1;
    const clusterId = makeId(200, clusterIndex);
    const createdHoursAgo = 1 + ((index * 2.7) % 46);
    const lastActivityHoursAgo = Math.max(0.4, createdHoursAgo - (index % 4) * 0.8);
    const latitude = jitterCoord(area.lat, random);
    const longitude = jitterCoord(area.lng, random);
    const riskJitter = index < 6 ? 0 : Math.round((random() - 0.5) * 8);
    const confidenceJitter = index < 6 ? 0 : Math.round((random() - 0.5) * 10);
    const risk_score = clamp(template.risk_score + riskJitter);
    const confidence_score = clamp(template.confidence_score + confidenceJitter);
    const title = pickText(template.title, area);
    const description = pickText(template.description, area);
    const summary = pickText(template.summary, area);
    const action = pickText(template.action, area);
    const risk_reason = pickText(template.risk_reason, area);
    const confidence_reason = pickText(template.confidence_reason, area);
    const reportStatus = template.status === "resolved" ? "resolved" : confidence_score >= 78 ? "verified" : "active";
    const reportId = makeId(100, clusterIndex);
    const clusterAnalysis = analysis({
      category: template.category,
      risk_score,
      confidence_score,
      risk_reason,
      confidence_reason,
      recommended_action: action,
    });

    const report: Report = {
      id: reportId,
      user_id: profiles[index % profiles.length].id,
      title,
      description,
      category: template.category,
      urgency: template.urgency,
      status: reportStatus,
      latitude,
      longitude,
      address_text: area.label,
      image_url: null,
      image_storage_path: null,
      risk_score,
      confidence_score,
      analysis_summary: summary,
      analysis_json: clusterAnalysis,
      cluster_id: clusterId,
      is_anonymous: index % 7 === 0,
      is_locked: false,
      moderation_flag: null,
      created_at: ago(createdHoursAgo),
      updated_at: ago(lastActivityHoursAgo),
    };
    reports.push(report);

    const shouldAddSecondReport = index % 5 === 0 || (index > 6 && random() > 0.82);
    if (shouldAddSecondReport) {
      reports.push({
        ...report,
        id: makeId(101, clusterIndex),
        user_id: profiles[(index + 1) % profiles.length].id,
        title: `Additional verification near ${area.label}`,
        description: `A second community report describes the same place-based condition near ${area.label}.`,
        risk_score: clamp(risk_score - 2),
        confidence_score: clamp(confidence_score + 6),
        analysis_summary: `Additional community verification supports the ${CATEGORY_CONFIG[template.category].label.toLowerCase()} cluster near ${area.label}.`,
        created_at: ago(Math.max(0.7, createdHoursAgo - 0.6)),
        updated_at: ago(Math.max(0.4, lastActivityHoursAgo - 0.3)),
      });
    }

    const hasSignal = Boolean(template.source_title && (index < 6 || index % 3 !== 1));
    if (hasSignal) {
      const source_type = template.source_type || "manual";
      const feed = sourceFeedForType(source_type, source_feeds);
      public_signals.push({
        id: makeId(300, clusterIndex),
        source_feed_id: feed.id,
        source_name: feed.name,
        source_type,
        source_url: `https://example.org/civicsignal-demo/${clusterIndex}`,
        external_id: `demo-signal-${String(clusterIndex).padStart(3, "0")}`,
        title: pickText(template.source_title!, area),
        text: pickText(template.source_text || template.summary, area),
        category: template.category,
        status: "matched",
        latitude,
        longitude,
        address_text: area.label,
        published_at: ago(Math.max(0.4, lastActivityHoursAgo + 0.2)),
        risk_score: clamp(risk_score - 5),
        confidence_score: clamp(confidence_score + 4),
        analysis_summary: `Public signal supports the ${CATEGORY_CONFIG[template.category].label.toLowerCase()} cluster near ${area.label}.`,
        analysis_json: analysis({
          category: template.category,
          risk_score: clamp(risk_score - 5),
          confidence_score: clamp(confidence_score + 4),
          risk_reason,
          confidence_reason,
          recommended_action: action,
        }),
        cluster_id: clusterId,
        created_at: ago(Math.max(0.4, lastActivityHoursAgo + 0.2)),
        updated_at: ago(Math.max(0.4, lastActivityHoursAgo + 0.2)),
      });
    }

    const confirmationCount = template.status === "resolved" ? 2 : confidence_score >= 75 ? 2 : confidence_score >= 62 ? 1 : 0;
    const resolvedCount = template.status === "resolved" ? 2 : 0;
    const disputeCount = index % 11 === 0 && template.status !== "resolved" ? 1 : 0;
    const clusterReports = reports.filter((item) => item.cluster_id === clusterId);
    const clusterSignals = public_signals.filter((item) => item.cluster_id === clusterId);

    risk_clusters.push({
      id: clusterId,
      title,
      summary,
      category: template.category,
      status: template.status,
      latitude,
      longitude,
      radius_meters: CATEGORY_CONFIG[template.category].cluster_radius_meters,
      risk_level: riskLevelFromScore(risk_score),
      risk_score,
      confidence_score,
      report_count: clusterReports.length,
      signal_count: clusterSignals.length,
      confirmation_count: confirmationCount,
      dispute_count: disputeCount,
      resolved_count: resolvedCount,
      photo_count: 0,
      last_activity_at: ago(lastActivityHoursAgo),
      action_plan: action,
      analysis_json: clusterAnalysis,
      created_at: ago(createdHoursAgo),
      updated_at: ago(lastActivityHoursAgo),
    });

    for (let voteIndex = 0; voteIndex < confirmationCount; voteIndex += 1) {
      report_votes.push({
        id: makeId(500 + voteIndex, clusterIndex),
        report_id: reportId,
        user_id: profiles[(voteIndex + 1) % profiles.length].id,
        vote_type: "confirm",
        comment: "Place-based condition observed nearby.",
        created_at: ago(Math.max(0.3, lastActivityHoursAgo - voteIndex * 0.2)),
      });
      cluster_votes.push({
        id: makeId(600 + voteIndex, clusterIndex),
        cluster_id: clusterId,
        user_id: profiles[(voteIndex + 1) % profiles.length].id,
        vote_type: "confirm",
        comment: "Cluster still appears relevant.",
        created_at: ago(Math.max(0.3, lastActivityHoursAgo - voteIndex * 0.2)),
      });
    }

    for (let voteIndex = 0; voteIndex < resolvedCount; voteIndex += 1) {
      cluster_votes.push({
        id: makeId(610 + voteIndex, clusterIndex),
        cluster_id: clusterId,
        user_id: profiles[voteIndex % profiles.length].id,
        vote_type: "resolved",
        comment: "Issue appears resolved.",
        created_at: ago(Math.max(0.3, lastActivityHoursAgo - voteIndex * 0.2)),
      });
    }

    if (disputeCount) {
      report_votes.push({
        id: makeId(520, clusterIndex),
        report_id: reportId,
        user_id: profiles[2].id,
        vote_type: "dispute",
        comment: "Needs more verification before escalation.",
        created_at: ago(Math.max(0.4, lastActivityHoursAgo - 0.1)),
      });
      cluster_votes.push({
        id: makeId(620, clusterIndex),
        cluster_id: clusterId,
        user_id: profiles[2].id,
        vote_type: "dispute",
        comment: "Needs more verification before escalation.",
        created_at: ago(Math.max(0.4, lastActivityHoursAgo - 0.1)),
      });
    }
  });

  const sensitiveReport: Report = {
    id: makeId(199, 1),
    user_id: profiles[0].id,
    title: "Named person accused of selling vapes",
    description: "Alex Morgan is definitely selling vapes to students after school.",
    category: "unauthorized_vending",
    urgency: "urgent",
    status: "needs_review",
    latitude: 37.7785,
    longitude: -122.4264,
    address_text: "School walkway",
    image_url: null,
    image_storage_path: null,
    risk_score: 0,
    confidence_score: 20,
    analysis_summary: "Sensitive report held for moderation because it identifies a private person and makes an absolute claim.",
    analysis_json: analysis({
      category: "unauthorized_vending",
      risk_score: 0,
      confidence_score: 20,
      risk_reason: "This item is not shown publicly because it contains a private-person accusation.",
      confidence_reason: "Confidence is Very Low until moderation reviews the sensitive claim.",
      recommended_action: "Remove private-person details before any public display.",
      moderation_flags: ["personal_accusation", "unsafe_claim"],
    }),
    cluster_id: null,
    is_anonymous: true,
    is_locked: false,
    moderation_flag: "personal_accusation",
    created_at: ago(3),
    updated_at: ago(3),
  };
  reports.push(sensitiveReport);

  const cluster_items = [
    ...reports
      .filter((report) => report.cluster_id)
      .map((report, index) => ({
        id: makeId(400, index + 1),
        cluster_id: report.cluster_id!,
        item_type: "report" as const,
        item_id: report.id,
        created_at: report.created_at,
      })),
    ...public_signals.map((signal, index) => ({
      id: makeId(450, index + 1),
      cluster_id: signal.cluster_id!,
      item_type: "signal" as const,
      item_id: signal.id,
      created_at: signal.created_at,
    })),
  ];

  const report_updates = reports.map((report, index) => ({
    id: makeId(700, index + 1),
    report_id: report.id,
    cluster_id: report.cluster_id,
    user_id: report.user_id,
    update_type: "system_analysis" as const,
    text: report.analysis_summary || "Report analyzed.",
    metadata: { created_from_seed: true },
    created_at: report.created_at,
  }));

  const moderation_actions = [
    {
      id: makeId(800, 1),
      actor_id: profiles[1].id,
      target_type: "report" as const,
      target_id: sensitiveReport.id,
      action: "needs_review",
      reason: "Private-person accusation and absolute claim must be reviewed before any public display.",
      metadata: {},
      created_at: ago(2.9),
    },
  ];

  const categories = Object.entries(CATEGORY_CONFIG).map(([slug, config], index) => ({
    id: makeId(900, index + 1),
    name: config.label,
    slug,
    base_severity: config.base_severity,
    icon: config.icon,
    color: config.color,
    is_active: true,
    created_at: ago(700),
  }));
  const caseOps = createSeedCaseOps(risk_clusters, reports, public_signals);

  return {
    profiles: profiles as CivicState["profiles"],
    reports,
    public_signals,
    risk_clusters,
    incident_cases: caseOps.incident_cases,
    danger_zones: caseOps.danger_zones,
    case_events: caseOps.case_events,
    cluster_items,
    report_votes,
    cluster_votes,
    report_updates,
    source_feeds: source_feeds as CivicState["source_feeds"],
    moderation_actions,
    geocode_cache: [],
    ai_cache: [],
    categories: categories as CivicState["categories"],
  };
}
