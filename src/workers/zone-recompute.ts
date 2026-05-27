import { bus } from "@/lib/events/bus";
import { withMutableState } from "@/lib/data-store";
import type { CivicState, DangerZone, GeoJsonGeometry } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { inferZoneMode } from "@/lib/events/domain";

function polygonAround(latitude: number, longitude: number, radius: number): GeoJsonGeometry {
  return {
    type: "Polygon",
    coordinates: [[
      [longitude - radius, latitude - radius * 0.55],
      [longitude - radius * 0.2, latitude + radius],
      [longitude + radius, latitude + radius * 0.42],
      [longitude + radius * 0.72, latitude - radius],
      [longitude - radius, latitude - radius * 0.55],
    ]],
  };
}

function radiusForZone(zone: DangerZone) {
  if (zone.type === "official_predicted_zone") return 0.0032;
  if (zone.severity >= 75) return 0.0028;
  if (zone.severity >= 50) return 0.0022;
  return 0.0018;
}

export function recomputeZonesInState(state: CivicState) {
  let updated = 0;

  for (const zone of state.danger_zones) {
    if (!zone.cluster_id) continue;
    const cluster = state.risk_clusters.find((item) => item.id === zone.cluster_id);
    if (!cluster) continue;

    zone.geometry = polygonAround(cluster.latitude, cluster.longitude, radiusForZone(zone));
    zone.updated_at = nowIso();
    updated += 1;
    bus.emit({ type: "zone.computed", zone, mode: inferZoneMode(zone) });
  }

  return {
    processed: state.danger_zones.length,
    updated,
  };
}

export async function runZoneRecomputeJob() {
  return withMutableState((state) => recomputeZonesInState(state));
}
