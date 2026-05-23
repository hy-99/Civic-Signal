import { CATEGORY_CONFIG } from "@/lib/constants";
import { loadState, withMutableState } from "@/lib/data-store";
import type {
  ClusterItem,
  ClusterVoteType,
  MapFilters,
  PublicSignal,
  Report,
  ReportUpdate,
  RiskCluster,
  RiskClusterStatus,
  RiskClusterView,
} from "@/lib/types";
import { generateActionPlan, summarizeRiskCluster } from "@/services/ai";
import { scoreCluster } from "@/services/scoring";
import { averageCoordinates, createId, haversineDistanceMeters, nowIso } from "@/lib/utils";

type CivicState = Awaited<ReturnType<typeof loadState>>;

const PUBLIC_CLUSTER_STATUSES = ["active", "monitoring", "in_progress", "verified", "urgent"] as const satisfies readonly RiskClusterStatus[];
const CLEARED_CLUSTER_STATUSES = ["resolved", "false_alarm"] as const satisfies readonly RiskClusterStatus[];

export type RiskClusterMapStats = {
  active: number;
  urgent: number;
  cleared: number;
};

function getClusterItems(state: CivicState, cluster_id: string) {
  return state.cluster_items.filter((item) => item.cluster_id === cluster_id);
}

function getReportsForCluster(state: CivicState, cluster_id: string) {
  return getClusterItems(state, cluster_id)
    .filter((item) => item.item_type === "report")
    .map((item) => state.reports.find((report) => report.id === item.item_id))
    .filter((item): item is Report => Boolean(item));
}

function getSignalsForCluster(state: CivicState, cluster_id: string) {
  return getClusterItems(state, cluster_id)
    .filter((item) => item.item_type === "signal")
    .map((item) => state.public_signals.find((signal) => signal.id === item.item_id))
    .filter((item): item is PublicSignal => Boolean(item));
}

function summarizeClusterVotes(state: CivicState, cluster_id: string) {
  const votes = state.cluster_votes.filter((vote) => vote.cluster_id === cluster_id);
  return {
    confirm: votes.filter((vote) => vote.vote_type === "confirm").length,
    dispute: votes.filter((vote) => vote.vote_type === "dispute").length,
    resolved: votes.filter((vote) => vote.vote_type === "resolved").length,
    monitor: votes.filter((vote) => vote.vote_type === "monitor").length,
  };
}

function categoryMatches(left: Report["category"], right: Report["category"]) {
  return left === right || CATEGORY_CONFIG[left].related.includes(right) || CATEGORY_CONFIG[right].related.includes(left);
}

export function isPublicCluster(cluster: Pick<RiskCluster, "status">) {
  return (PUBLIC_CLUSTER_STATUSES as readonly RiskClusterStatus[]).includes(cluster.status);
}

export function getRiskClusterMapStatsFromState(state: CivicState): RiskClusterMapStats {
  const publicClusters = state.risk_clusters.filter(isPublicCluster);
  return {
    active: publicClusters.length,
    urgent: publicClusters.filter((cluster) => cluster.risk_level === "urgent" || cluster.risk_level === "serious").length,
    cleared: state.risk_clusters.filter((cluster) => (CLEARED_CLUSTER_STATUSES as readonly RiskClusterStatus[]).includes(cluster.status)).length,
  };
}

export function applyClusterStatusToReportsInState(state: CivicState, cluster_id: string, status: RiskClusterStatus) {
  const reportStatus =
    status === "resolved"
      ? "resolved"
      : status === "false_alarm"
        ? "false_alarm"
        : status === "hidden"
          ? "hidden"
          : null;

  if (!reportStatus) return 0;

  const reportIds = new Set(
    state.cluster_items
      .filter((item) => item.cluster_id === cluster_id && item.item_type === "report")
      .map((item) => item.item_id),
  );
  let updated = 0;
  for (const report of state.reports) {
    if (!reportIds.has(report.id)) continue;
    if (report.status !== reportStatus) {
      report.status = reportStatus;
      report.updated_at = nowIso();
      updated += 1;
    }
  }
  return updated;
}

function clusterWindowHours(category: Report["category"]) {
  return CATEGORY_CONFIG[category].long_window_hours || 72;
}

function itemCoordinates(item: Pick<Report, "latitude" | "longitude"> | Pick<PublicSignal, "latitude" | "longitude">) {
  return {
    latitude: item.latitude ?? 0,
    longitude: item.longitude ?? 0,
  };
}

export function findMatchingClusterInState(
  state: Awaited<ReturnType<typeof loadState>>,
  item: Pick<Report, "category" | "latitude" | "longitude" | "created_at">,
) {
  const windowHours = clusterWindowHours(item.category);
  const eligible = state.risk_clusters.filter((cluster) => {
    if (!isPublicCluster(cluster)) return false;
    if (!categoryMatches(cluster.category, item.category)) return false;
    const distance = haversineDistanceMeters(
      { latitude: cluster.latitude, longitude: cluster.longitude },
      { latitude: item.latitude, longitude: item.longitude },
    );
    const radius = Math.max(cluster.radius_meters, CATEGORY_CONFIG[item.category].cluster_radius_meters);
    if (distance > radius) return false;
    const lastActivityHours = (Date.now() - new Date(cluster.last_activity_at).getTime()) / 3_600_000;
    return lastActivityHours <= windowHours;
  });

  return eligible.sort((a, b) => b.confidence_score - a.confidence_score)[0] || null;
}

export async function findMatchingCluster(item: Pick<Report, "category" | "latitude" | "longitude" | "created_at">) {
  const state = await loadState();
  return findMatchingClusterInState(state, item);
}

export function attachItemToClusterInState(
  state: Awaited<ReturnType<typeof loadState>>,
  cluster_id: string,
  item_type: ClusterItem["item_type"],
  item_id: string,
  created_at = nowIso(),
) {
  const exists = state.cluster_items.find((item) => item.cluster_id === cluster_id && item.item_type === item_type && item.item_id === item_id);
  if (exists) return exists;
  const clusterItem: ClusterItem = {
    id: createId(),
    cluster_id,
    item_type,
    item_id,
    created_at,
  };
  state.cluster_items.push(clusterItem);
  return clusterItem;
}

export async function attachItemToCluster(cluster_id: string, item_type: ClusterItem["item_type"], item_id: string) {
  return withMutableState((state) => attachItemToClusterInState(state, cluster_id, item_type, item_id));
}

export async function recalculateClusterInState(state: Awaited<ReturnType<typeof loadState>>, cluster_id: string) {
  const cluster = state.risk_clusters.find((item) => item.id === cluster_id);
  if (!cluster) return null;
  const reports = getReportsForCluster(state, cluster_id);
  const signals = getSignalsForCluster(state, cluster_id);
  const voteSummary = summarizeClusterVotes(state, cluster_id);
  const coords = averageCoordinates([
    ...reports.map((report) => itemCoordinates(report)),
    ...signals
      .filter((signal) => signal.latitude !== null && signal.longitude !== null)
      .map((signal) => itemCoordinates({ latitude: signal.latitude, longitude: signal.longitude })),
  ]);

  if (coords.latitude && coords.longitude) {
    cluster.latitude = coords.latitude;
    cluster.longitude = coords.longitude;
  }

  const score = scoreCluster(cluster, reports, signals, voteSummary);
  const summary = await summarizeRiskCluster(cluster, reports, signals);
  const action_plan = await generateActionPlan(cluster, reports, signals);

  cluster.report_count = reports.length;
  cluster.signal_count = signals.length;
  cluster.confirmation_count = voteSummary.confirm;
  cluster.dispute_count = voteSummary.dispute;
  cluster.resolved_count = voteSummary.resolved;
  cluster.photo_count = reports.filter((report) => Boolean(report.image_url)).length;
  cluster.last_activity_at = nowIso();
  cluster.risk_score = score.risk_score;
  cluster.confidence_score = score.confidence_score;
  cluster.risk_level = score.risk_level;
  cluster.summary = typeof summary.riskReason === "string" ? summary.riskReason : cluster.summary;
  cluster.action_plan = action_plan;
  cluster.analysis_json = {
    score_breakdown: score,
    moderation_flags: [],
    matching_summary: typeof summary.confidenceReason === "string" ? summary.confidenceReason : undefined,
  };
  cluster.updated_at = nowIso();
  return cluster;
}

export async function createClusterFromReportInState(state: Awaited<ReturnType<typeof loadState>>, report: Report) {
  const cluster: RiskCluster = {
    id: createId(),
    title: `Possible ${CATEGORY_CONFIG[report.category].label.toLowerCase()} near ${report.address_text || "reported area"}`,
    summary: report.analysis_summary,
    category: report.category,
    status: "active",
    latitude: report.latitude,
    longitude: report.longitude,
    radius_meters: CATEGORY_CONFIG[report.category].cluster_radius_meters,
    risk_level: report.urgency,
    risk_score: report.risk_score,
    confidence_score: report.confidence_score,
    report_count: 0,
    signal_count: 0,
    confirmation_count: 0,
    dispute_count: 0,
    resolved_count: 0,
    photo_count: report.image_url ? 1 : 0,
    last_activity_at: nowIso(),
    action_plan: "Monitor for more reports and verify with trusted sources if available.",
    analysis_json: report.analysis_json,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.risk_clusters.push(cluster);
  attachItemToClusterInState(state, cluster.id, "report", report.id, report.created_at);
  report.cluster_id = cluster.id;
  await recalculateClusterInState(state, cluster.id);
  return cluster;
}

export async function createClusterFromReport(report: Report) {
  return withMutableState((state) => createClusterFromReportInState(state, report));
}

export async function createClusterFromSignalInState(state: Awaited<ReturnType<typeof loadState>>, signal: PublicSignal) {
  const cluster: RiskCluster = {
    id: createId(),
    title: `Possible ${CATEGORY_CONFIG[signal.category].label.toLowerCase()} near ${signal.address_text || "signal area"}`,
    summary: signal.analysis_summary,
    category: signal.category,
    status: "active",
    latitude: signal.latitude ?? 0,
    longitude: signal.longitude ?? 0,
    radius_meters: CATEGORY_CONFIG[signal.category].cluster_radius_meters,
    risk_level: signal.analysis_json.score_breakdown.risk_level,
    risk_score: signal.risk_score,
    confidence_score: signal.confidence_score,
    report_count: 0,
    signal_count: 0,
    confirmation_count: 0,
    dispute_count: 0,
    resolved_count: 0,
    photo_count: 0,
    last_activity_at: nowIso(),
    action_plan: "Review the source and match with nearby citizen reports.",
    analysis_json: signal.analysis_json,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.risk_clusters.push(cluster);
  attachItemToClusterInState(state, cluster.id, "signal", signal.id, signal.created_at);
  signal.cluster_id = cluster.id;
  await recalculateClusterInState(state, cluster.id);
  return cluster;
}

export async function createClusterFromSignal(signal: PublicSignal) {
  return withMutableState((state) => createClusterFromSignalInState(state, signal));
}

export async function linkReportToClusterInState(state: Awaited<ReturnType<typeof loadState>>, report: Report) {
  const cluster = findMatchingClusterInState(state, report);
  if (cluster) {
    attachItemToClusterInState(state, cluster.id, "report", report.id, report.created_at);
    report.cluster_id = cluster.id;
    await recalculateClusterInState(state, cluster.id);
    return cluster;
  }
  return createClusterFromReportInState(state, report);
}

export async function linkSignalToClusterInState(state: Awaited<ReturnType<typeof loadState>>, signal: PublicSignal) {
  if (signal.latitude === null || signal.longitude === null) {
    return createClusterFromSignalInState(state, signal);
  }

  const cluster = findMatchingClusterInState(state, {
    category: signal.category,
    latitude: signal.latitude,
    longitude: signal.longitude,
    created_at: signal.published_at || signal.created_at,
  });

  if (cluster) {
    attachItemToClusterInState(state, cluster.id, "signal", signal.id, signal.created_at);
    signal.cluster_id = cluster.id;
    await recalculateClusterInState(state, cluster.id);
    return cluster;
  }

  return createClusterFromSignalInState(state, signal);
}

function buildClusterView(state: CivicState, cluster: RiskCluster): RiskClusterView {
  const reports = getReportsForCluster(state, cluster.id);
  const signals = getSignalsForCluster(state, cluster.id);
  return {
    ...cluster,
    confidence_label: cluster.analysis_json.score_breakdown.confidence_label,
    evidence_count: reports.length + signals.length,
    score_breakdown: cluster.analysis_json.score_breakdown,
    reports,
    signals,
    vote_summary: summarizeClusterVotes(state, cluster.id),
  };
}

export async function getRiskClusters(params?: MapFilters & { include_hidden?: boolean }) {
  const state = await loadState();
  let items = state.risk_clusters.filter((cluster) => (params?.include_hidden ? true : isPublicCluster(cluster)));

  if (params?.category && params.category !== "all") items = items.filter((cluster) => cluster.category === params.category);
  if (params?.risk_level && params.risk_level !== "all") items = items.filter((cluster) => cluster.risk_level === params.risk_level);
  if (params?.query) items = items.filter((cluster) => cluster.title.toLowerCase().includes(params.query!.toLowerCase()));

  items = items.sort((a, b) => {
    if (params?.sort === "recent") return +new Date(b.last_activity_at) - +new Date(a.last_activity_at);
    if (params?.sort === "confidence") return b.confidence_score - a.confidence_score;
    if (params?.sort === "confirmed") return b.confirmation_count - a.confirmation_count;
    return b.risk_score - a.risk_score || b.confidence_score - a.confidence_score;
  });

  return items.map((cluster) => buildClusterView(state, cluster));
}

export async function getRiskClusterMapStats() {
  const state = await loadState();
  return getRiskClusterMapStatsFromState(state);
}

export async function getRiskClusterById(id: string) {
  const state = await loadState();
  const cluster = state.risk_clusters.find((item) => item.id === id);
  if (!cluster) return null;
  return buildClusterView(state, cluster);
}

export async function recalculateCluster(cluster_id: string) {
  return withMutableState(async (state) => {
    const cluster = await recalculateClusterInState(state, cluster_id);
    return cluster ? buildClusterView(state, cluster) : null;
  });
}

export async function voteOnCluster(cluster_id: string, user_id: string, vote_type: ClusterVoteType, comment?: string | null) {
  return withMutableState(async (state) => {
    const existing = state.cluster_votes.find((vote) => vote.cluster_id === cluster_id && vote.user_id === user_id && vote.vote_type === vote_type);
    if (!existing) {
      state.cluster_votes.push({
        id: createId(),
        cluster_id,
        user_id,
        vote_type,
        comment: comment || null,
        created_at: nowIso(),
      });
    }

    state.report_updates.push({
      id: createId(),
      report_id: null,
      cluster_id,
      user_id,
      update_type: "vote",
      text: `Cluster marked as ${vote_type}.`,
      metadata: {},
      created_at: nowIso(),
    });

    await recalculateClusterInState(state, cluster_id);
    const cluster = state.risk_clusters.find((item) => item.id === cluster_id);
    return cluster || null;
  });
}

export async function addClusterUpdate(input: {
  cluster_id: string;
  user_id?: string | null;
  text: string;
  update_type?: Extract<ReportUpdate["update_type"], "comment" | "admin_note" | "resolved">;
}) {
  return withMutableState((state) => {
    const cluster = state.risk_clusters.find((item) => item.id === input.cluster_id);
    if (!cluster) throw new Error("Cluster not found.");

    const update: ReportUpdate = {
      id: createId(),
      report_id: null,
      cluster_id: input.cluster_id,
      user_id: input.user_id || null,
      update_type: input.update_type || "comment",
      text: input.text,
      metadata: {},
      created_at: nowIso(),
    };
    state.report_updates.push(update);
    cluster.last_activity_at = update.created_at;
    cluster.updated_at = update.created_at;
    return update;
  });
}

export async function updateClusterStatus(id: string, status: RiskCluster["status"]) {
  return withMutableState(async (state) => {
    const cluster = state.risk_clusters.find((item) => item.id === id);
    if (!cluster) throw new Error("Cluster not found.");
    cluster.status = status;
    cluster.updated_at = nowIso();
    applyClusterStatusToReportsInState(state, id, status);
    await recalculateClusterInState(state, id);
    return cluster;
  });
}

export async function mergeClusters(source_id: string, target_id: string) {
  return withMutableState(async (state) => {
    const source = state.risk_clusters.find((item) => item.id === source_id);
    const target = state.risk_clusters.find((item) => item.id === target_id);
    if (!source || !target) throw new Error("Cluster not found.");

    for (const item of state.cluster_items.filter((entry) => entry.cluster_id === source_id)) {
      item.cluster_id = target_id;
      if (item.item_type === "report") {
        const report = state.reports.find((entry) => entry.id === item.item_id);
        if (report) report.cluster_id = target_id;
      } else {
        const signal = state.public_signals.find((entry) => entry.id === item.item_id);
        if (signal) signal.cluster_id = target_id;
      }
    }

    source.status = "hidden";
    source.updated_at = nowIso();
    await recalculateClusterInState(state, target_id);
    return target;
  });
}

export async function splitCluster(cluster_id: string) {
  return withMutableState(async (state) => {
    const source = state.risk_clusters.find((item) => item.id === cluster_id);
    if (!source) throw new Error("Cluster not found.");
    const items = state.cluster_items.filter((item) => item.cluster_id === cluster_id);
    if (items.length <= 1) return source;

    const [, ...rest] = items;
    const restItemIds = new Set(rest.map((item) => item.id));
    state.cluster_items = state.cluster_items.filter((item) => !restItemIds.has(item.id));

    for (const item of rest) {
      if (item.item_type === "report") {
        const report = state.reports.find((entry) => entry.id === item.item_id);
        if (report) await createClusterFromReportInState(state, report);
      } else {
        const signal = state.public_signals.find((entry) => entry.id === item.item_id);
        if (signal) await createClusterFromSignalInState(state, signal);
      }
    }

    await recalculateClusterInState(state, cluster_id);
    return source;
  });
}
