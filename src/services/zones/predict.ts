import type { CivicState, GeoJsonGeometry, PublicSignal, Report, RiskCluster } from "@/lib/types";
import { circlePolygon } from "@/lib/geo/buffer";

function itemTimestamp(item: Pick<Report, "created_at"> | Pick<PublicSignal, "published_at" | "created_at">) {
  return "published_at" in item ? item.published_at || item.created_at : item.created_at;
}

function collectTimedPoints(state: CivicState, cluster: RiskCluster) {
  const reportIds = state.cluster_items
    .filter((item) => item.cluster_id === cluster.id && item.item_type === "report")
    .map((item) => item.item_id);
  const signalIds = state.cluster_items
    .filter((item) => item.cluster_id === cluster.id && item.item_type === "signal")
    .map((item) => item.item_id);

  const reportPoints = state.reports
    .filter((report) => reportIds.includes(report.id))
    .map((report) => ({
      latitude: report.latitude,
      longitude: report.longitude,
      timestamp: report.created_at,
    }));

  const signalPoints = state.public_signals
    .filter((signal) => signalIds.includes(signal.id) && signal.latitude !== null && signal.longitude !== null)
    .map((signal) => ({
      latitude: signal.latitude ?? 0,
      longitude: signal.longitude ?? 0,
      timestamp: itemTimestamp(signal),
    }));

  return [...reportPoints, ...signalPoints]
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
}

export function predictZoneGeometry(
  state: CivicState,
  cluster: RiskCluster,
  options?: { now?: string; horizon_minutes?: number; radius_meters?: number },
): { geometry: GeoJsonGeometry; estimated_arrival_at: string } | null {
  const now = new Date(options?.now || new Date().toISOString());
  const horizonMinutes = options?.horizon_minutes ?? 30;
  const radiusMeters = options?.radius_meters ?? Math.max(cluster.radius_meters, 220);
  const recentWindowStart = now.getTime() - 60 * 60 * 1000;

  const points = collectTimedPoints(state, cluster).filter((point) => +new Date(point.timestamp) >= recentWindowStart);
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const deltaMs = +new Date(last.timestamp) - +new Date(first.timestamp);
  if (deltaMs <= 0) return null;

  const projectMs = horizonMinutes * 60 * 1000;
  const ratio = Math.min(projectMs / deltaMs, 2);
  const projectedLatitude = last.latitude + (last.latitude - first.latitude) * ratio;
  const projectedLongitude = last.longitude + (last.longitude - first.longitude) * ratio;
  const estimatedArrival = new Date(last.timestamp).getTime() + projectMs;

  return {
    geometry: circlePolygon(projectedLatitude, projectedLongitude, radiusMeters),
    estimated_arrival_at: new Date(estimatedArrival).toISOString(),
  };
}
