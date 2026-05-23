import { CATEGORY_CONFIG, CONFIDENCE_LABELS, REPORT_SCORING } from "@/lib/constants";
import type {
  ConfidenceLabel,
  ImageAnalysisResult,
  PublicSignal,
  Report,
  ReportCategoryKey,
  RiskCluster,
  RiskLevel,
  ScoreBreakdown,
  ScoreFactor,
} from "@/lib/types";
import { clamp, haversineDistanceMeters, isWithinHours } from "@/lib/utils";

const NO_HAZARD_RISK_CAP = 20;
const SEVERITY_RISK_CAP: Record<RiskLevel, number> = {
  low: 24,
  watch: 49,
  serious: 74,
  urgent: 100,
};

export function isRealImageAnalysis(
  image_analysis: ImageAnalysisResult | null | undefined,
): image_analysis is ImageAnalysisResult {
  if (!image_analysis) return false;
  if (image_analysis.danger_score <= 0) return false;
  const details = (image_analysis.details_observed || "").toLowerCase();
  if (details.startsWith("could not analyze")) return false;
  const reasoning = (image_analysis.danger_reasoning || "").toLowerCase();
  if (reasoning.includes("api key not configured")) return false;
  return true;
}

export type ImageClaimMismatch = "no_hazard" | "wrong_category";

export interface ImageClaimAssessment {
  matches: boolean;
  mismatch_kind: ImageClaimMismatch | null;
  explanation: string;
}

export function assessImageClaimConsistency(
  report: { title: string; description: string; category: ReportCategoryKey },
  image_analysis: ImageAnalysisResult | null | undefined,
): ImageClaimAssessment {
  if (!isRealImageAnalysis(image_analysis)) {
    return { matches: true, mismatch_kind: null, explanation: "" };
  }

  const observed = image_analysis.details_observed?.trim() || "";
  const aiReason = image_analysis.claim_mismatch_reason?.trim();
  const categoryLabel = CATEGORY_CONFIG[report.category].label;

  if (image_analysis.confirms_hazard === false) {
    const reason = aiReason ||
      (observed
        ? `The image shows: "${observed}". The AI did not detect a civic hazard, so it does not support a "${categoryLabel}" report.`
        : `The AI did not detect any civic hazard in the image, so it does not support a "${categoryLabel}" report.`);
    return { matches: false, mismatch_kind: "no_hazard", explanation: reason };
  }

  if (image_analysis.matches_claim === false) {
    const reason = aiReason ||
      (observed
        ? `Your "${categoryLabel}" report does not match the image, which shows: "${observed}".`
        : `The image does not appear to depict the "${categoryLabel}" issue described in your title or description.`);
    return { matches: false, mismatch_kind: "wrong_category", explanation: reason };
  }

  return { matches: true, mismatch_kind: null, explanation: "" };
}

function detailedDescription(text: string) {
  return text.trim().length >= 30;
}

function hasSpecificLocation(address_text: string | null, latitude: number | null, longitude: number | null) {
  return Boolean(address_text || (latitude !== null && longitude !== null));
}

export function calculateRecencyBonus(date: string) {
  if (isWithinHours(date, 1)) return REPORT_SCORING.bonuses.recent_hour;
  if (isWithinHours(date, 6)) return REPORT_SCORING.bonuses.recent_six_hours;
  if (isWithinHours(date, 24)) return REPORT_SCORING.bonuses.recent_day;
  return 0;
}

export function calculateDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  return haversineDistanceMeters(a, b);
}

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "urgent";
  if (score >= 50) return "serious";
  if (score >= 25) return "watch";
  return "low";
}

export function getConfidenceLabel(score: number): ConfidenceLabel {
  return CONFIDENCE_LABELS.find((entry) => score >= entry.min)?.label ?? "very_low";
}

export function generateScoreExplanation(input: {
  category_label: string;
  risk_level: RiskLevel;
  confidence_label: ConfidenceLabel;
  risk_factors: ScoreFactor[];
  confidence_factors: ScoreFactor[];
  corroboration_text: string;
  action_text: string;
}): Pick<ScoreBreakdown, "risk_reason" | "confidence_reason" | "recommended_action"> {
  const strongestRisk = input.risk_factors
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((item) => item.label.toLowerCase());

  const strongestConfidence = input.confidence_factors
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((item) => item.label.toLowerCase());

  return {
    risk_reason: `Risk is ${input.risk_level[0].toUpperCase()}${input.risk_level.slice(1)} because this ${input.category_label.toLowerCase()} signal is shaped by ${strongestRisk.join(", ")}.`,
    confidence_reason: `Confidence is ${input.confidence_label.replace("_", " ")} because ${strongestConfidence.join(", ")}. ${input.corroboration_text}`,
    recommended_action: input.action_text,
  };
}

export function scoreReport(
  report: Report,
  context: {
    nearby_related_reports: number;
    related_signals: PublicSignal[];
    confirmation_count: number;
    dispute_count: number;
    resolved_count: number;
    high_trust_user: boolean;
  },
) {
  const category = CATEGORY_CONFIG[report.category];
  const risk_factors: ScoreFactor[] = [{ label: `${category.label} category`, value: category.base_severity, type: "base" }];
  const confidence_factors: ScoreFactor[] = [];

  let risk_score = category.base_severity + REPORT_SCORING.urgency_bonus[report.urgency];
  risk_factors.push({ label: `${report.urgency[0].toUpperCase()}${report.urgency.slice(1)} urgency`, value: REPORT_SCORING.urgency_bonus[report.urgency], type: "bonus" });

  const recencyBonus = calculateRecencyBonus(report.created_at);
  if (recencyBonus) {
    risk_score += recencyBonus;
    risk_factors.push({ label: "Recent report", value: recencyBonus, type: "bonus" });
    confidence_factors.push({ label: "Recent timestamp", value: REPORT_SCORING.confidence.recent, type: "bonus" });
  }

  if (report.image_url) {
    risk_score += REPORT_SCORING.bonuses.image;
    risk_factors.push({ label: "Image evidence", value: REPORT_SCORING.bonuses.image, type: "bonus" });
    confidence_factors.push({ label: "Image evidence", value: REPORT_SCORING.confidence.image, type: "bonus" });
  }

  const imageAnalysis = report.analysis_json.image_analysis;
  if (imageAnalysis?.confirms_hazard && imageAnalysis.evidence_score >= 60) {
    risk_score += 6;
    risk_factors.push({ label: "AI image confirms hazard", value: 6, type: "bonus" });
    confidence_factors.push({ label: "AI image confirms hazard", value: 12, type: "bonus" });
  } else if (imageAnalysis && !imageAnalysis.confirms_hazard && imageAnalysis.evidence_score < 20) {
    risk_score -= 12;
    risk_factors.push({ label: "Image does not confirm hazard", value: -12, type: "penalty" });
    confidence_factors.push({ label: "Image does not confirm hazard", value: -16, type: "penalty" });
  } else if (!imageAnalysis && report.image_url) {
    confidence_factors.push({ label: "Image needs review", value: 4, type: "bonus" });
  }

  if (detailedDescription(report.description)) {
    risk_score += REPORT_SCORING.bonuses.description;
    risk_factors.push({ label: "Detailed description", value: REPORT_SCORING.bonuses.description, type: "bonus" });
    confidence_factors.push({ label: "Detailed description", value: REPORT_SCORING.confidence.detail, type: "bonus" });
  } else {
    risk_score -= REPORT_SCORING.penalties.no_detail;
    risk_factors.push({ label: "Limited detail", value: -REPORT_SCORING.penalties.no_detail, type: "penalty" });
  }

  if (hasSpecificLocation(report.address_text, report.latitude, report.longitude)) {
    risk_score += REPORT_SCORING.bonuses.specific_location;
    risk_factors.push({ label: "Specific location", value: REPORT_SCORING.bonuses.specific_location, type: "bonus" });
    confidence_factors.push({ label: "Specific location", value: REPORT_SCORING.confidence.specific_location, type: "bonus" });
  } else {
    risk_score -= REPORT_SCORING.penalties.vague_location;
    risk_factors.push({ label: "Vague location", value: -REPORT_SCORING.penalties.vague_location, type: "penalty" });
  }

  const relatedReportBonus = Math.min(
    context.nearby_related_reports * REPORT_SCORING.bonuses.nearby_report,
    REPORT_SCORING.bonuses.nearby_report_cap,
  );
  if (relatedReportBonus) {
    risk_score += relatedReportBonus;
    risk_factors.push({ label: "Nearby related reports", value: relatedReportBonus, type: "bonus" });
    confidence_factors.push({ label: "Multiple citizen reports", value: REPORT_SCORING.confidence.multiple_reports, type: "bonus" });
  }

  const relatedSignalBonus = Math.min(
    context.related_signals.length * REPORT_SCORING.bonuses.related_signal,
    REPORT_SCORING.bonuses.related_signal_cap,
  );
  if (relatedSignalBonus) {
    risk_score += relatedSignalBonus;
    risk_factors.push({ label: "Related public signals", value: relatedSignalBonus, type: "bonus" });
    confidence_factors.push({ label: "Matched public signal", value: REPORT_SCORING.confidence.matched_signal, type: "bonus" });
  }

  const officialSignals = context.related_signals.filter((signal) => ["city_alert", "weather", "traffic"].includes(signal.source_type));
  if (officialSignals.length) {
    risk_score += REPORT_SCORING.bonuses.official_source;
    risk_factors.push({ label: "Official or city source", value: REPORT_SCORING.bonuses.official_source, type: "bonus" });
    confidence_factors.push({ label: "Trusted source", value: REPORT_SCORING.confidence.trusted_source, type: "bonus" });
  }

  if (context.related_signals.some((signal) => signal.source_type === "weather")) {
    risk_score += REPORT_SCORING.bonuses.weather_signal;
    risk_factors.push({ label: "Weather alert context", value: REPORT_SCORING.bonuses.weather_signal, type: "bonus" });
  }

  if (context.related_signals.some((signal) => signal.source_type === "traffic" || signal.source_type === "city_alert")) {
    risk_score += REPORT_SCORING.bonuses.traffic_signal;
    risk_factors.push({ label: "Traffic or city alert context", value: REPORT_SCORING.bonuses.traffic_signal, type: "bonus" });
  }

  const confirmationBonus = Math.min(
    context.confirmation_count * REPORT_SCORING.bonuses.confirmation,
    REPORT_SCORING.bonuses.confirmation_cap,
  );
  if (confirmationBonus) {
    risk_score += confirmationBonus;
    risk_factors.push({ label: "Community confirmations", value: confirmationBonus, type: "bonus" });
    confidence_factors.push({ label: "Confirmed by community", value: REPORT_SCORING.confidence.confirmed, type: "bonus" });
  }

  if (context.high_trust_user) {
    risk_score += REPORT_SCORING.bonuses.high_trust;
    risk_factors.push({ label: "High trust reporter", value: REPORT_SCORING.bonuses.high_trust, type: "bonus" });
    confidence_factors.push({ label: "High trust user", value: REPORT_SCORING.confidence.high_trust, type: "bonus" });
  }

  const disputePenalty = Math.min(
    context.dispute_count * REPORT_SCORING.penalties.dispute,
    REPORT_SCORING.penalties.dispute_cap,
  );
  if (disputePenalty) {
    risk_score -= disputePenalty;
    risk_factors.push({ label: "Community disputes", value: -disputePenalty, type: "penalty" });
  }

  if (context.resolved_count > 0) {
    risk_score -= REPORT_SCORING.penalties.resolved_threshold;
    risk_factors.push({ label: "Resolved vote threshold", value: -REPORT_SCORING.penalties.resolved_threshold, type: "penalty" });
  }

  if (!isWithinHours(report.created_at, 24 * 30)) {
    risk_score -= REPORT_SCORING.penalties.older_than_month;
    risk_factors.push({ label: "Older than 30 days", value: -REPORT_SCORING.penalties.older_than_month, type: "penalty" });
  } else if (!isWithinHours(report.created_at, 24 * 7)) {
    risk_score -= REPORT_SCORING.penalties.older_than_week;
    risk_factors.push({ label: "Older than 7 days", value: -REPORT_SCORING.penalties.older_than_week, type: "penalty" });
  }

  if (report.status === "false_alarm") {
    risk_score = 0;
    risk_factors.push({ label: "False alarm status", value: -100, type: "penalty" });
  }

  let confidence_score = confidence_factors.reduce((sum, factor) => sum + factor.value, 0);
  if (context.dispute_count > context.confirmation_count) {
    confidence_score -= 10;
    confidence_factors.push({ label: "Disputed by community", value: -10, type: "penalty" });
  }

  if (isRealImageAnalysis(imageAnalysis)) {
    if (imageAnalysis.confirms_hazard === false && risk_score > NO_HAZARD_RISK_CAP) {
      risk_factors.push({
        label: "AI image shows no hazard — risk capped",
        value: NO_HAZARD_RISK_CAP - risk_score,
        type: "penalty",
      });
      risk_score = NO_HAZARD_RISK_CAP;
    } else if (imageAnalysis.confirms_hazard === true) {
      const cap = SEVERITY_RISK_CAP[imageAnalysis.severity_estimate];
      if (typeof cap === "number" && risk_score > cap) {
        risk_factors.push({
          label: `AI image severity is ${imageAnalysis.severity_estimate} — risk capped`,
          value: cap - risk_score,
          type: "penalty",
        });
        risk_score = cap;
      }
    }
  }

  risk_score = clamp(risk_score, 0, 100);
  confidence_score = clamp(confidence_score, 0, 100);

  const risk_level = getRiskLevel(risk_score);
  const confidence_label = getConfidenceLabel(confidence_score);
  const explanation = generateScoreExplanation({
    category_label: category.label,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    corroboration_text:
      context.related_signals.length || context.nearby_related_reports
        ? "Multiple sources indicate the situation may be real."
        : "More corroboration would strengthen this signal.",
    action_text:
      risk_level === "urgent"
        ? "Prioritize verification quickly and check official local alerts."
        : risk_level === "serious"
          ? "Review with nearby users and route to the right responder."
          : "Monitor for duplicate reports and update if conditions worsen.",
  });

  return {
    risk_score,
    confidence_score,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    ...explanation,
  } satisfies ScoreBreakdown;
}

export function scoreSignal(
  signal: PublicSignal,
  context: {
    trusted_source: boolean;
    matched_cluster: boolean;
  },
) {
  const category = CATEGORY_CONFIG[signal.category];
  const risk_factors: ScoreFactor[] = [{ label: `${category.label} category`, value: category.base_severity, type: "base" }];
  const confidence_factors: ScoreFactor[] = [];

  let risk_score = category.base_severity;
  if (context.trusted_source) {
    risk_score += REPORT_SCORING.bonuses.official_source;
    risk_factors.push({ label: "Trusted source", value: REPORT_SCORING.bonuses.official_source, type: "bonus" });
    confidence_factors.push({ label: "Trusted source", value: REPORT_SCORING.confidence.trusted_source, type: "bonus" });
  }

  const publishedAt = signal.published_at || signal.created_at;
  const recencyBonus = calculateRecencyBonus(publishedAt);
  if (recencyBonus) {
    risk_score += recencyBonus;
    risk_factors.push({ label: "Recent signal", value: recencyBonus, type: "bonus" });
    confidence_factors.push({ label: "Recent timestamp", value: REPORT_SCORING.confidence.recent, type: "bonus" });
  }

  if (signal.latitude !== null && signal.longitude !== null) {
    confidence_factors.push({ label: "Specific location", value: REPORT_SCORING.confidence.specific_location, type: "bonus" });
  }

  if (context.matched_cluster) {
    confidence_factors.push({ label: "Matched public signal", value: REPORT_SCORING.confidence.matched_signal, type: "bonus" });
  }

  const confidence_score = clamp(confidence_factors.reduce((sum, factor) => sum + factor.value, 0), 0, 100);
  const finalRisk = clamp(risk_score, 0, 100);
  const risk_level = getRiskLevel(finalRisk);
  const confidence_label = getConfidenceLabel(confidence_score);
  const explanation = generateScoreExplanation({
    category_label: category.label,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    corroboration_text: context.matched_cluster ? "It also aligns with an existing cluster." : "It still needs matching or community verification.",
    action_text: context.trusted_source
      ? "Use this as supporting evidence for nearby reports or clusters."
      : "Review the source before elevating this signal.",
  });

  return {
    risk_score: finalRisk,
    confidence_score,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    ...explanation,
  } satisfies ScoreBreakdown;
}

export function scoreCluster(
  cluster: RiskCluster,
  reports: Report[],
  signals: PublicSignal[],
  votes: { confirm: number; dispute: number; resolved: number },
) {
  const strongestReport = reports.reduce((max, report) => Math.max(max, report.risk_score), 0);
  const strongestSignal = signals.reduce((max, signal) => Math.max(max, signal.risk_score), 0);
  const evidenceScore = reports.length * 8 + signals.length * 6 + votes.confirm * 4 - votes.dispute * 6 - votes.resolved * 5;
  const risk_score = clamp(Math.max(strongestReport, strongestSignal, cluster.risk_score) + evidenceScore, 0, 100);
  const confidence_score = clamp(
    reports.length * 18 + signals.length * 12 + votes.confirm * 8 - votes.dispute * 6 + (signals.some((signal) => ["weather", "traffic", "city_alert"].includes(signal.source_type)) ? 15 : 0),
    0,
    100,
  );
  const risk_level = getRiskLevel(risk_score);
  const confidence_label = getConfidenceLabel(confidence_score);

  const risk_factors: ScoreFactor[] = [
    { label: "Linked citizen reports", value: reports.length * 8, type: "bonus" },
    { label: "Linked public signals", value: signals.length * 6, type: "bonus" },
    { label: "Community confirmations", value: votes.confirm * 4, type: "bonus" },
  ];
  const confidence_factors: ScoreFactor[] = [
    { label: "Citizen reports", value: reports.length * 18, type: "bonus" },
    { label: "Public signals", value: signals.length * 12, type: "bonus" },
    { label: "Community confirmations", value: votes.confirm * 8, type: "bonus" },
  ];
  if (votes.dispute) {
    risk_factors.push({ label: "Community disputes", value: -(votes.dispute * 6), type: "penalty" });
    confidence_factors.push({ label: "Community disputes", value: -(votes.dispute * 6), type: "penalty" });
  }

  const explanation = generateScoreExplanation({
    category_label: CATEGORY_CONFIG[cluster.category].label,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    corroboration_text:
      signals.length || reports.length > 1
        ? "Several evidence streams reinforce this cluster."
        : "The cluster still has limited corroboration.",
    action_text:
      risk_level === "urgent"
        ? "Surface prominently on the map and encourage official-source verification."
        : "Keep tracking related reports and signals.",
  });

  return {
    risk_score,
    confidence_score,
    risk_level,
    confidence_label,
    risk_factors,
    confidence_factors,
    ...explanation,
  } satisfies ScoreBreakdown;
}
