import { loadState, withMutableState } from "@/lib/data-store";
import type {
  AnalysisJson,
  AuthViewer,
  MapFilters,
  Report,
  ReportCardView,
  ReportStatus,
  ReportVoteType,
} from "@/lib/types";
import { analyzeReportText } from "@/services/ai";
import { linkReportToClusterInState, recalculateClusterInState } from "@/services/clusters";
import { geocodeAddress } from "@/services/geocoding";
import { checkReportForModeration } from "@/services/moderation";
import { scoreReport } from "@/services/scoring";
import { createId, nowIso } from "@/lib/utils";

function reportVoteSummary(state: Awaited<ReturnType<typeof loadState>>, report_id: string) {
  const votes = state.report_votes.filter((vote) => vote.report_id === report_id);
  return {
    confirm: votes.filter((vote) => vote.vote_type === "confirm").length,
    dispute: votes.filter((vote) => vote.vote_type === "dispute").length,
    resolved: votes.filter((vote) => vote.vote_type === "resolved").length,
    duplicate: votes.filter((vote) => vote.vote_type === "duplicate").length,
  };
}

function reportIsPublic(report: Report) {
  return ["active", "needs_review", "verified", "resolved"].includes(report.status);
}

function canViewReport(report: Report, viewer?: AuthViewer | null) {
  if (reportIsPublic(report)) return true;
  if (!viewer) return false;
  return viewer.id === report.user_id || ["moderator", "admin"].includes(viewer.role);
}

async function recalculateReportScoreInState(state: Awaited<ReturnType<typeof loadState>>, report_id: string) {
  const report = state.reports.find((item) => item.id === report_id);
  if (!report) return null;
  const nearbyRelatedReports = state.reports.filter(
    (candidate) =>
      candidate.id !== report.id &&
      candidate.category === report.category &&
      Math.abs(candidate.latitude - report.latitude) < 0.01 &&
      Math.abs(candidate.longitude - report.longitude) < 0.01,
  ).length;
  const relatedSignals = state.public_signals.filter(
    (signal) =>
      signal.category === report.category ||
      (report.cluster_id !== null && signal.cluster_id === report.cluster_id) ||
      (signal.latitude !== null &&
        signal.longitude !== null &&
        Math.abs(signal.latitude - report.latitude) < 0.01 &&
        Math.abs(signal.longitude - report.longitude) < 0.01),
  );
  const voteSummary = reportVoteSummary(state, report.id);
  const profile = state.profiles.find((item) => item.id === report.user_id) || null;
  const score = scoreReport(report, {
    nearby_related_reports: nearbyRelatedReports,
    related_signals: relatedSignals,
    confirmation_count: voteSummary.confirm,
    dispute_count: voteSummary.dispute,
    resolved_count: voteSummary.resolved,
    high_trust_user: Boolean(profile && profile.trust_score >= 70),
  });

  report.risk_score = score.risk_score;
  report.confidence_score = score.confidence_score;
  report.analysis_summary = score.risk_reason;
  const existingAnalysis = report.analysis_json;
  report.analysis_json = {
    score_breakdown: score,
    moderation_flags: existingAnalysis.moderation_flags || [],
    extracted_location_text: report.address_text,
    image_analysis: report.analysis_json.image_analysis || null,
  };
  report.updated_at = nowIso();
  return report;
}


function buildReportView(state: Awaited<ReturnType<typeof loadState>>, report: Report): ReportCardView {
  const cluster = report.cluster_id ? state.risk_clusters.find((item) => item.id === report.cluster_id) || null : null;
  const profile = state.profiles.find((item) => item.id === report.user_id) || null;
  const relatedSignals = report.cluster_id ? state.public_signals.filter((signal) => signal.cluster_id === report.cluster_id) : [];
  const relatedReports = report.cluster_id ? state.reports.filter((candidate) => candidate.cluster_id === report.cluster_id && candidate.id !== report.id) : [];
  return {
    ...report,
    confidence_label: report.analysis_json.score_breakdown.confidence_label,
    risk_level: report.analysis_json.score_breakdown.risk_level,
    vote_summary: reportVoteSummary(state, report.id),
    evidence_count: Number(Boolean(report.image_url)) + relatedSignals.length + relatedReports.length,
    related_signal_count: relatedSignals.length,
    related_report_count: relatedReports.length,
    display_name: report.is_anonymous ? "Anonymous" : profile?.display_name || "Community member",
    cluster,
  };
}

export async function createReport(
  input: Pick<
    Report,
    "title" | "description" | "category" | "urgency" | "address_text" | "image_url" | "image_storage_path" | "is_anonymous"
  > & {
    latitude?: number | null;
    longitude?: number | null;
    image_analysis?: Record<string, unknown> | null;
  },
  viewer?: AuthViewer | null,
) {
  let latitude = input.latitude ?? null;
  let longitude = input.longitude ?? null;
  if ((latitude === null || longitude === null) && input.address_text) {
    const geocoded = await geocodeAddress(input.address_text);
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }
  if (latitude === null || longitude === null) throw new Error("Location is required.");

  const aiPreview = await analyzeReportText({
    title: input.title,
    description: input.description,
    category: input.category,
    address_text: input.address_text || null,
  });
  return withMutableState(async (state) => {
    const draft: Report = {
      id: createId(),
      user_id: viewer?.id || null,
      title: input.title,
      description: input.description,
      category: input.category,
      urgency: input.urgency,
      status: "active",
      latitude,
      longitude,
      address_text: input.address_text || null,
      image_url: input.image_url || null,
      image_storage_path: input.image_storage_path || null,
      risk_score: 0,
      confidence_score: 0,
      analysis_summary: null,
      analysis_json: {
        score_breakdown: {
          risk_score: 0,
          confidence_score: 0,
          risk_level: "low",
          confidence_label: "very_low",
          risk_factors: [],
          confidence_factors: [],
          risk_reason: "",
          confidence_reason: "",
          recommended_action: "",
        },
        moderation_flags: [],
        image_analysis: (input.image_analysis as AnalysisJson["image_analysis"]) || null,
      },
      cluster_id: null,
      is_anonymous: input.is_anonymous,
      is_locked: false,
      moderation_flag: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const moderation = checkReportForModeration(draft);
    draft.status = moderation.needs_review ? "needs_review" : "active";
    draft.moderation_flag = moderation.moderation_flag;
    draft.analysis_json.moderation_flags = moderation.moderation_flags;
    draft.analysis_json.extracted_location_text = typeof aiPreview.extractedLocationText === "string" ? aiPreview.extractedLocationText : null;

    state.reports.push(draft);
    state.report_updates.push({
      id: createId(),
      report_id: draft.id,
      cluster_id: null,
      user_id: viewer?.id || null,
      update_type: "comment",
      text: "Report created.",
      metadata: {},
      created_at: draft.created_at,
    });

    await linkReportToClusterInState(state, draft);
    await recalculateReportScoreInState(state, draft.id);
    if (draft.cluster_id) await recalculateClusterInState(state, draft.cluster_id);

    state.report_updates.push({
      id: createId(),
      report_id: draft.id,
      cluster_id: draft.cluster_id,
      user_id: null,
      update_type: "system_analysis",
      text: draft.analysis_summary || "Scoring completed.",
      metadata: {},
      created_at: nowIso(),
    });

    return buildReportView(state, draft);
  });
}

export async function getReports(params?: MapFilters & { viewer?: AuthViewer | null }) {
  const state = await loadState();
  let items = state.reports.filter((report) => canViewReport(report, params?.viewer));

  if (params?.category && params.category !== "all") items = items.filter((report) => report.category === params.category);
  if (params?.risk_level && params.risk_level !== "all") items = items.filter((report) => report.analysis_json.score_breakdown.risk_level === params.risk_level);
  if (params?.status && params.status !== "all") items = items.filter((report) => report.status === params.status);
  if (params?.query) items = items.filter((report) => `${report.title} ${report.description}`.toLowerCase().includes(params.query!.toLowerCase()));

  items = items.sort((a, b) => {
    if (params?.sort === "recent") return +new Date(b.created_at) - +new Date(a.created_at);
    if (params?.sort === "confirmed") return reportVoteSummary(state, b.id).confirm - reportVoteSummary(state, a.id).confirm;
    return b.risk_score - a.risk_score || b.confidence_score - a.confidence_score;
  });

  return items.map((report) => buildReportView(state, report));
}

export async function getReportById(id: string, viewer?: AuthViewer | null) {
  const state = await loadState();
  const report = state.reports.find((item) => item.id === id);
  if (!report || !canViewReport(report, viewer)) return null;
  return buildReportView(state, report);
}

export async function getUserReports(user_id: string) {
  return getReports({ viewer: { id: user_id, role: "user", display_name: "", username: "", home_city: null, is_demo_mode: true } }).then((reports) =>
    reports.filter((report) => report.user_id === user_id),
  );
}

export async function updateReportStatus(id: string, status: ReportStatus) {
  return withMutableState(async (state) => {
    const report = state.reports.find((item) => item.id === id);
    if (!report) throw new Error("Report not found.");
    report.status = status;
    report.updated_at = nowIso();
    await recalculateReportScoreInState(state, id);
    if (report.cluster_id) await recalculateClusterInState(state, report.cluster_id);
    return buildReportView(state, report);
  });
}

export async function addReportUpdate(input: { report_id: string; cluster_id?: string | null; user_id?: string | null; text: string; update_type: "comment" | "admin_note" | "resolved" }) {
  return withMutableState((state) => {
    const update = {
      id: createId(),
      report_id: input.report_id,
      cluster_id: input.cluster_id || null,
      user_id: input.user_id || null,
      update_type: input.update_type,
      text: input.text,
      metadata: {},
      created_at: nowIso(),
    };
    state.report_updates.push(update);
    return update;
  });
}

export async function voteOnReport(report_id: string, user_id: string, vote_type: ReportVoteType, comment?: string | null) {
  return withMutableState(async (state) => {
    const report = state.reports.find((item) => item.id === report_id);
    if (!report) throw new Error("Report not found.");
    const existing = state.report_votes.find((vote) => vote.report_id === report_id && vote.user_id === user_id && vote.vote_type === vote_type);
    if (!existing) {
      state.report_votes.push({
        id: createId(),
        report_id,
        user_id,
        vote_type,
        comment: comment || null,
        created_at: nowIso(),
      });
    }
    state.report_updates.push({
      id: createId(),
      report_id,
      cluster_id: report.cluster_id,
      user_id,
      update_type: "vote",
      text: `Community vote recorded: ${vote_type}.`,
      metadata: {},
      created_at: nowIso(),
    });

    if (vote_type === "resolved") report.status = "resolved";
    if (vote_type === "duplicate") report.status = "duplicate";
    await recalculateReportScoreInState(state, report_id);
    if (report.cluster_id) await recalculateClusterInState(state, report.cluster_id);
    return buildReportView(state, report);
  });
}

export async function recalculateReportScores(id: string) {
  return withMutableState(async (state) => {
    const report = await recalculateReportScoreInState(state, id);
    if (!report) return null;
    if (report.cluster_id) await recalculateClusterInState(state, report.cluster_id);
    return buildReportView(state, report);
  });
}

export async function patchReport(id: string, input: Partial<Pick<Report, "title" | "description" | "category" | "urgency" | "status" | "is_locked">>) {
  return withMutableState(async (state) => {
    const report = state.reports.find((item) => item.id === id);
    if (!report) throw new Error("Report not found.");
    Object.assign(report, input, { updated_at: nowIso() });
    await recalculateReportScoreInState(state, id);
    if (report.cluster_id) await recalculateClusterInState(state, report.cluster_id);
    return buildReportView(state, report);
  });
}
