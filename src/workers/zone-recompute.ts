import { CATEGORY_CONFIG } from "@/lib/constants";
import { withMutableState } from "@/lib/data-store";
import { shouldAutoApproveZones } from "@/lib/env";
import { bus } from "@/lib/events/bus";
import { inferZoneMode } from "@/lib/events/domain";
import type { CivicState, DangerZone, RiskCluster } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { syncIncidentWithZoneInState, createDangerZoneForCaseInState } from "@/services/cases";
import { computeAutoZoneGeometry } from "@/services/zones/auto-compute";
import { predictZoneGeometry } from "@/services/zones/predict";

function isActiveCluster(cluster: RiskCluster) {
  return !["resolved", "false_alarm", "hidden"].includes(cluster.status);
}

function clusterPoints(state: CivicState, cluster: RiskCluster) {
  const linkedItems = state.cluster_items.filter((item) => item.cluster_id === cluster.id);

  return linkedItems.flatMap((item) => {
    if (item.item_type === "report") {
      const report = state.reports.find((candidate) => candidate.id === item.item_id);
      return report ? [{ latitude: report.latitude, longitude: report.longitude }] : [];
    }

    const signal = state.public_signals.find((candidate) => candidate.id === item.item_id);
    if (!signal || signal.latitude === null || signal.longitude === null) return [];
    return [{ latitude: signal.latitude, longitude: signal.longitude }];
  });
}

function ensureApproval(zone: DangerZone, timestamp: string) {
  if (!shouldAutoApproveZones() || zone.approved_at) return;
  zone.approved_at = timestamp;
  zone.approved_by = zone.approved_by ?? null;
}

function updateComputedZone(
  zone: DangerZone,
  patch: Partial<Pick<DangerZone, "geometry" | "severity" | "confidence" | "estimated_arrival_at" | "instructions" | "label">>,
  timestamp: string,
) {
  Object.assign(zone, patch, {
    updated_at: timestamp,
  });
  ensureApproval(zone, timestamp);
}

function upsertComputedZone(
  state: CivicState,
  cluster: RiskCluster,
  input: Pick<DangerZone, "type" | "mode" | "geometry" | "label" | "severity" | "confidence" | "estimated_arrival_at" | "instructions">,
  timestamp: string,
) {
  const existing = state.danger_zones.find((zone) => zone.cluster_id === cluster.id && zone.mode === input.mode);
  if (existing) {
    updateComputedZone(existing, input, timestamp);
    syncIncidentWithZoneInState(state, existing);
    bus.emit({ type: "zone.computed", zone: existing, mode: inferZoneMode(existing) });
    return { zone: existing, created: false };
  }

  const zone = createDangerZoneForCaseInState(state, {
    case_id: cluster.linked_case_id ?? null,
    report_id: null,
    cluster_id: cluster.id,
    parent_cluster_id: cluster.id,
    type: input.type,
    mode: input.mode,
    geometry: input.geometry,
    label: input.label,
    severity: input.severity,
    confidence: input.confidence,
    starts_at: timestamp,
    expires_at: null,
    estimated_arrival_at: input.estimated_arrival_at,
    instructions: input.instructions,
    approved_at: input.mode === "manual" ? timestamp : shouldAutoApproveZones() ? timestamp : null,
    approved_by: null,
    created_by_role: "system",
  });
  return { zone, created: true };
}

export function recomputeZonesInState(state: CivicState, options?: { now?: string }) {
  const timestamp = options?.now || nowIso();
  let created = 0;
  let updated = 0;
  let predicted = 0;

  const clusters = state.risk_clusters.filter(isActiveCluster);

  for (const cluster of clusters) {
    const points = clusterPoints(state, cluster);
    if (points.length === 0) continue;

    const autoGeometry = computeAutoZoneGeometry(points, {
      buffer_meters: CATEGORY_CONFIG[cluster.category].cluster_radius_meters,
      fallback_radius_meters: Math.max(200, CATEGORY_CONFIG[cluster.category].cluster_radius_meters),
    });

    const autoResult = upsertComputedZone(
      state,
      cluster,
      {
        type: "official_active_zone",
        mode: "auto",
        geometry: autoGeometry,
        label: `${CATEGORY_CONFIG[cluster.category].label} auto zone`,
        severity: cluster.risk_score,
        confidence: cluster.confidence_score,
        estimated_arrival_at: null,
        instructions: "Auto-computed from linked reports and signals. Pending moderator approval before public display.",
      },
      timestamp,
    );
    if (autoResult.created) created += 1;
    else updated += 1;

    const prediction = predictZoneGeometry(state, cluster, {
      now: timestamp,
      radius_meters: Math.max(CATEGORY_CONFIG[cluster.category].cluster_radius_meters, 220),
    });
    if (!prediction) continue;

    const predictedResult = upsertComputedZone(
      state,
      cluster,
      {
        type: "official_predicted_zone",
        mode: "predicted",
        geometry: prediction.geometry,
        label: `${CATEGORY_CONFIG[cluster.category].label} predicted zone`,
        severity: Math.max(20, cluster.risk_score - 8),
        confidence: Math.max(20, cluster.confidence_score - 10),
        estimated_arrival_at: prediction.estimated_arrival_at,
        instructions: "Predicted from recent cluster movement. Pending moderator approval before public display.",
      },
      timestamp,
    );
    if (predictedResult.created) created += 1;
    else updated += 1;
    predicted += 1;
  }

  return {
    processed: clusters.length,
    created,
    updated,
    predicted,
  };
}

export async function runZoneRecomputeJob() {
  return withMutableState((state) => recomputeZonesInState(state));
}
