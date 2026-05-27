import { CATEGORY_CONFIG, SEMANTIC_CLUSTER_MATCH } from "@/lib/constants";
import { cosineSimilarity } from "@/lib/vector";
import type { Report, RiskCluster } from "@/lib/types";
import { haversineDistanceMeters } from "@/lib/utils";

type CivicState = {
  risk_clusters: RiskCluster[];
};

export type ClusterMatchReason = "spatial" | "semantic" | "both";

export type MatchCandidate = Pick<Report, "category" | "latitude" | "longitude" | "created_at"> & {
  embedding?: number[] | null;
};

export interface ClusterMatchResult {
  cluster: RiskCluster;
  reason: ClusterMatchReason;
  score: number;
  distance_meters: number;
  spatial_score: number;
  temporal_score: number;
  semantic_similarity: number;
}

function categoryMatches(left: Report["category"], right: Report["category"]) {
  return left === right || CATEGORY_CONFIG[left].related.includes(right) || CATEGORY_CONFIG[right].related.includes(left);
}

function clusterWindowHours(category: Report["category"]) {
  return CATEGORY_CONFIG[category].long_window_hours || 72;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function scoreClusterMatch(item: MatchCandidate, cluster: RiskCluster): ClusterMatchResult | null {
  if (!categoryMatches(cluster.category, item.category)) return null;
  if (!["active", "monitoring", "in_progress", "verified", "urgent"].includes(cluster.status)) return null;

  const maxWindowHours = Math.max(clusterWindowHours(item.category), clusterWindowHours(cluster.category));
  const lastActivityHours = Math.abs(new Date(item.created_at).getTime() - new Date(cluster.last_activity_at).getTime()) / 3_600_000;
  if (lastActivityHours > maxWindowHours) return null;

  const distance_meters = haversineDistanceMeters(
    { latitude: cluster.latitude, longitude: cluster.longitude },
    { latitude: item.latitude, longitude: item.longitude },
  );

  const normalRadius = Math.max(cluster.radius_meters, CATEGORY_CONFIG[item.category].cluster_radius_meters);
  const maxSemanticDistance = Math.max(normalRadius * SEMANTIC_CLUSTER_MATCH.spatial_falloff_multiplier, normalRadius);
  if (distance_meters > maxSemanticDistance) return null;

  const withinNormalRadius = distance_meters <= normalRadius;
  const hasEmbeddings = Boolean(item.embedding?.length && cluster.embedding?.length);
  if (!hasEmbeddings) {
    if (!withinNormalRadius) return null;
    return {
      cluster,
      reason: "spatial",
      score: 1,
      distance_meters,
      spatial_score: clamp01(1 - distance_meters / normalRadius),
      temporal_score: clamp01(1 - lastActivityHours / maxWindowHours),
      semantic_similarity: 0,
    };
  }

  const spatial_score = clamp01(1 - distance_meters / maxSemanticDistance);
  const temporal_score = clamp01(1 - lastActivityHours / maxWindowHours);
  const semantic_similarity = cosineSimilarity(item.embedding, cluster.embedding);
  const score =
    SEMANTIC_CLUSTER_MATCH.weights.spatial * spatial_score +
    SEMANTIC_CLUSTER_MATCH.weights.temporal * temporal_score +
    SEMANTIC_CLUSTER_MATCH.weights.semantic * semantic_similarity;

  if (score < SEMANTIC_CLUSTER_MATCH.match_threshold) return null;

  const semanticStrong = semantic_similarity >= SEMANTIC_CLUSTER_MATCH.semantic_reason_threshold;
  const reason: ClusterMatchReason = semanticStrong ? (withinNormalRadius ? "both" : "semantic") : "spatial";

  return {
    cluster,
    reason,
    score,
    distance_meters,
    spatial_score,
    temporal_score,
    semantic_similarity,
  };
}

export function createClusterMatchAuditText(result: ClusterMatchResult) {
  if (result.reason === "semantic") {
    return `Matched via semantic similarity ${result.semantic_similarity.toFixed(2)} beyond the normal radius (${Math.round(result.distance_meters)}m).`;
  }
  if (result.reason === "both") {
    return `Matched via spatial + semantic similarity ${result.semantic_similarity.toFixed(2)} at ${Math.round(result.distance_meters)}m.`;
  }
  return `Matched via spatial proximity at ${Math.round(result.distance_meters)}m.`;
}

export function findBestClusterMatchInState(state: CivicState, item: MatchCandidate) {
  const matches = state.risk_clusters
    .map((cluster) => scoreClusterMatch(item, cluster))
    .filter((match): match is ClusterMatchResult => Boolean(match))
    .sort((left, right) => right.score - left.score || right.semantic_similarity - left.semantic_similarity);

  return matches[0] || null;
}
