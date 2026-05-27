import { loadState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import { inferZoneMode } from "@/lib/events/domain";
import type { DangerZone, DangerZoneType } from "@/lib/types";
import { createDangerZoneForCaseInState, syncIncidentWithZoneInState } from "@/services/cases";
import { nowIso } from "@/lib/utils";

const PUBLIC_ZONE_TYPES = new Set<DangerZone["type"]>([
  "official_active_zone",
  "official_predicted_zone",
  "safe_zone",
  "evacuation_route",
  "road_closure",
  "shelter_area",
]);

export function getPublicDangerZonesFromState(state: Awaited<ReturnType<typeof loadState>>) {
  return state.danger_zones
    .filter((zone) => PUBLIC_ZONE_TYPES.has(zone.type) && Boolean(zone.approved_at))
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
}

export async function getDangerZones(params?: { include_private?: boolean; type?: DangerZoneType | "all"; case_id?: string }) {
  const state = await loadState();
  let items = params?.include_private ? state.danger_zones : getPublicDangerZonesFromState(state);
  if (params?.case_id) items = items.filter((item) => item.case_id === params.case_id);
  if (params?.type && params.type !== "all") items = items.filter((item) => item.type === params.type);
  return [...items].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
}

export async function createDangerZone(
  input: Omit<DangerZone, "id" | "created_at" | "updated_at" | "mode" | "approved_at" | "approved_by" | "parent_cluster_id"> &
    Partial<Pick<DangerZone, "mode" | "approved_at" | "approved_by" | "parent_cluster_id">>,
) {
  return withMutableState((state) => createDangerZoneForCaseInState(state, input));
}

export async function updateDangerZone(id: string, patch: Partial<Omit<DangerZone, "id" | "created_at">>) {
  return withMutableState((state) => {
    const zone = state.danger_zones.find((item) => item.id === id);
    if (!zone) throw new Error("Danger zone not found.");
    Object.assign(zone, patch, { updated_at: nowIso() });
    syncIncidentWithZoneInState(state, zone);
    bus.emit({ type: "zone.computed", zone, mode: inferZoneMode(zone) });
    return zone;
  });
}

export function approveDangerZoneInState(state: Awaited<ReturnType<typeof loadState>>, zone_id: string, approved_by: string | null) {
  const zone = state.danger_zones.find((item) => item.id === zone_id);
  if (!zone) throw new Error("Danger zone not found.");
  zone.approved_at = zone.approved_at || nowIso();
  zone.approved_by = approved_by;
  zone.updated_at = nowIso();
  syncIncidentWithZoneInState(state, zone);
  bus.emit({ type: "zone.approved", zone_id: zone.id });
  return zone;
}

export async function approveDangerZone(zone_id: string, approved_by: string | null) {
  return withMutableState((state) => approveDangerZoneInState(state, zone_id, approved_by));
}
