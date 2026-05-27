import { CATEGORY_CONFIG } from "@/lib/constants";
import type { HazardType, ImageAnalysisResult, Report, ReportCategoryKey } from "@/lib/types";
import { runGeminiJsonTask } from "@/services/ai";

export type CaseTriageInput = Pick<Report, "title" | "description" | "category" | "urgency" | "address_text"> & {
  image_analysis?: ImageAnalysisResult | null;
  nearby_report_count?: number;
  official_signal_count?: number;
};

export type CaseTriageResult = {
  suggestedTitle: string;
  hazardType: HazardType;
  severity: number;
  confidence: number;
  urgency: number;
  privacyRisk: number;
  evidenceMatch: number;
  duplicateLikelihood: number;
  recommendedOwner: string;
  publicSummary: string;
  responderSummary: string;
  reasoningSummary: string;
  requiredHumanReview: boolean;
};

const HAZARD_BY_CATEGORY: Partial<Record<ReportCategoryKey, HazardType>> = {
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

const URGENCY_POINTS = { low: 10, watch: 25, serious: 48, urgent: 72 } as const;

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function cleanTitle(input: CaseTriageInput, hazardType: HazardType) {
  const place = input.address_text?.trim();
  const label = CATEGORY_CONFIG[input.category].label.toLowerCase();
  if (hazardType === "public_disturbance") return `Reported public disturbance${place ? ` near ${place}` : ""}`;
  if (hazardType === "violence_threat") return `Reported safety concern${place ? ` near ${place}` : ""}`;
  if (hazardType === "unauthorized_vending") return `Reported public-space vending concern${place ? ` near ${place}` : ""}`;
  if (hazardType === "fire_smoke") return `Possible smoke hazard${place ? ` near ${place}` : ""}`;
  return `Possible ${label}${place ? ` near ${place}` : ""}`;
}

function privacyRiskForText(text: string) {
  let score = 8;
  if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text)) score += 35;
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\S+@\S+\.\S+\b/.test(text)) score += 30;
  if (/(guy|woman|man|person|kid|student|dealer|gang|criminal|weapon|gun|knife)/i.test(text)) score += 18;
  if (/(definitely|criminal|dealing|selling|attacked|assaulted|threatened)/i.test(text)) score += 20;
  return clamp(score);
}

function ownerForHazard(hazardType: HazardType) {
  if (hazardType === "fire_smoke" || hazardType === "medical_emergency") return "fire_ems";
  if (hazardType === "flooding" || hazardType === "road_blockage" || hazardType === "infrastructure_damage") return "public_works";
  if (hazardType === "sanitation") return "sanitation";
  if (hazardType === "school_area_concern") return "campus_safety";
  if (hazardType === "public_disturbance" || hazardType === "violence_threat") return "police";
  return "moderator";
}

function fallbackTriage(input: CaseTriageInput): CaseTriageResult {
  const text = `${input.title}\n${input.description}`;
  const hazardType = HAZARD_BY_CATEGORY[input.category] || "other";
  const image = input.image_analysis;
  const base = CATEGORY_CONFIG[input.category].base_severity;
  const severity = clamp(base + URGENCY_POINTS[input.urgency] + (image?.confirms_hazard ? 8 : 0));
  const privacyRisk = privacyRiskForText(text);
  const descriptionDepth = input.description.trim().length > 120 ? 12 : input.description.trim().length > 45 ? 7 : 0;
  const confidence = clamp(
    25 +
      descriptionDepth +
      (input.address_text ? 12 : 0) +
      (image?.confirms_hazard ? 20 : image ? -8 : 0) +
      (input.nearby_report_count ?? 0) * 8 +
      (input.official_signal_count ?? 0) * 14 -
      (privacyRisk >= 55 ? 12 : 0),
  );
  const evidenceMatch = clamp(
    image
      ? image.matches_claim === false
        ? 18
        : image.confirms_hazard
          ? Math.max(image.evidence_score, 62)
          : 28
      : 42 + descriptionDepth,
  );
  const duplicateLikelihood = clamp((input.nearby_report_count ?? 0) * 24 + (input.official_signal_count ?? 0) * 8);
  const requiredHumanReview =
    severity >= 72 ||
    privacyRisk >= 50 ||
    confidence < 36 ||
    ["violence_threat", "public_disturbance", "school_area_concern"].includes(hazardType) ||
    evidenceMatch < 32;

  return {
    suggestedTitle: cleanTitle(input, hazardType),
    hazardType,
    severity,
    confidence,
    urgency: clamp(URGENCY_POINTS[input.urgency] + (severity > 70 ? 18 : 0)),
    privacyRisk,
    evidenceMatch,
    duplicateLikelihood,
    recommendedOwner: ownerForHazard(hazardType),
    publicSummary: `${CATEGORY_CONFIG[input.category].label} report near ${input.address_text || "the selected location"}. Public visibility depends on confidence and moderation.`,
    responderSummary: `${input.description.trim().slice(0, 220)}${input.description.trim().length > 220 ? "..." : ""}`,
    reasoningSummary: `Rule fallback used category severity, urgency, location detail, evidence match, nearby evidence, and privacy risk. Severity=${severity}, confidence=${confidence}, privacy=${privacyRisk}.`,
    requiredHumanReview,
  };
}

function isTriageResult(value: unknown): value is CaseTriageResult {
  const candidate = value as Partial<CaseTriageResult>;
  return Boolean(
    candidate &&
      typeof candidate.suggestedTitle === "string" &&
      typeof candidate.hazardType === "string" &&
      typeof candidate.severity === "number" &&
      typeof candidate.confidence === "number" &&
      typeof candidate.urgency === "number",
  );
}

export async function triageReportForCaseOps(input: CaseTriageInput): Promise<CaseTriageResult> {
  const fallback = fallbackTriage(input);
  const ai = await runGeminiJsonTask(
    "caseops_report_triage",
    {
      title: input.title,
      description: input.description,
      category: input.category,
      urgency: input.urgency,
      address_text: input.address_text,
      image_analysis: input.image_analysis || null,
      nearby_report_count: input.nearby_report_count || 0,
      official_signal_count: input.official_signal_count || 0,
      required_json_shape: {
        suggestedTitle: "string",
        hazardType: "HazardType",
        severity: "0-100 number",
        confidence: "0-100 number",
        urgency: "0-100 number",
        privacyRisk: "0-100 number",
        evidenceMatch: "0-100 number",
        duplicateLikelihood: "0-100 number",
        recommendedOwner: "string",
        publicSummary: "string",
        responderSummary: "string",
        reasoningSummary: "string",
        requiredHumanReview: "boolean",
      },
    },
    [
      "You are CivicSignal CaseOps triage.",
      "Return strict JSON only.",
      "AI recommends but never officially confirms truth.",
      "Rewrite messy titles into neutral place-based civic titles.",
      "Do not accuse private individuals.",
      "Separate public-safe summary from responder summary.",
      "Trigger human review for high severity, privacy risk, violence/threat, unclear evidence, low confidence, or any official public alert.",
    ].join("\n"),
  );

  if (!isTriageResult(ai)) return fallback;
  return {
    suggestedTitle: ai.suggestedTitle || fallback.suggestedTitle,
    hazardType: (HAZARD_BY_CATEGORY[input.category] && ai.hazardType ? ai.hazardType : fallback.hazardType) as HazardType,
    severity: clamp(ai.severity),
    confidence: clamp(ai.confidence),
    urgency: clamp(ai.urgency),
    privacyRisk: clamp(ai.privacyRisk),
    evidenceMatch: clamp(ai.evidenceMatch),
    duplicateLikelihood: clamp(ai.duplicateLikelihood),
    recommendedOwner: ai.recommendedOwner || fallback.recommendedOwner,
    publicSummary: ai.publicSummary || fallback.publicSummary,
    responderSummary: ai.responderSummary || fallback.responderSummary,
    reasoningSummary: ai.reasoningSummary || fallback.reasoningSummary,
    requiredHumanReview: Boolean(ai.requiredHumanReview),
  };
}
