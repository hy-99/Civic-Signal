import { bus } from "@/lib/events/bus";
import { withMutableState } from "@/lib/data-store";
import type { CivicState, RiskClusterStatus } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { applyClusterStatusToReportsInState } from "@/services/clusters";
import { getRiskLevel } from "@/services/scoring";

const TERMINAL_CLUSTER_STATUSES = new Set<RiskClusterStatus>(["resolved", "hidden", "false_alarm", "merged"]);

export function applyClusterDecayInState(
  state: CivicState,
  options?: {
    now?: string;
    tau_hours?: number;
    resolve_threshold?: number;
    recent_hours?: number;
  },
) {
  const now = new Date(options?.now ?? nowIso());
  const tauHours = options?.tau_hours ?? 72;
  const resolveThreshold = options?.resolve_threshold ?? 10;
  const recentHours = options?.recent_hours ?? 48;

  let updated = 0;
  let resolved = 0;
  let cascaded_reports = 0;

  for (const cluster of state.risk_clusters) {
    if (TERMINAL_CLUSTER_STATUSES.has(cluster.status)) continue;

    const lastActiveAt = new Date(cluster.last_activity_at);
    const ageHours = Math.max(0, (now.getTime() - lastActiveAt.getTime()) / 3_600_000);
    const nextRiskScore = Math.max(0, Math.round(cluster.risk_score * Math.exp(-ageHours / tauHours)));

    let changed = false;
    if (nextRiskScore !== cluster.risk_score) {
      cluster.risk_score = nextRiskScore;
      cluster.risk_level = getRiskLevel(nextRiskScore);
      cluster.updated_at = now.toISOString();
      updated += 1;
      changed = true;
    }

    if (ageHours > recentHours && nextRiskScore < resolveThreshold && cluster.status !== "resolved") {
      cluster.status = "resolved";
      cluster.updated_at = now.toISOString();
      cascaded_reports += applyClusterStatusToReportsInState(state, cluster.id, "resolved");
      resolved += 1;
      changed = true;
    }

    if (changed) {
      bus.emit({ type: "cluster.updated", cluster });
    }
  }

  return {
    processed: state.risk_clusters.length,
    updated,
    resolved,
    cascaded_reports,
  };
}

export async function runClusterDecayJob(options?: Parameters<typeof applyClusterDecayInState>[1]) {
  return withMutableState((state) => applyClusterDecayInState(state, options));
}
