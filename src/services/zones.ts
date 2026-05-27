import { loadState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import { inferZoneMode } from "@/lib/events/domain";
import type { DangerZone, DangerZoneType } from "@/lib/types";
import { createDangerZoneForCaseInState } from "@/services/cases";
import { nowIso } from "@/lib/utils";

export async function getDangerZones(params?: { include_private?: boolean; type?: DangerZoneType | "all"; case_id?: string }) {
  const state = await loadState();
  let items = state.danger_zones;
  if (params?.case_id) items = items.filter((item) => item.case_id === params.case_id);
  if (params?.type && params.type !== "all") items = items.filter((item) => item.type === params.type);
  if (!params?.include_private) {
    items = items.filter((item) =>
      ["official_active_zone", "official_predicted_zone", "safe_zone", "evacuation_route", "road_closure", "shelter_area"].includes(item.type),
    );
  }
  return [...items].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
}

export async function createDangerZone(input: Omit<DangerZone, "id" | "created_at" | "updated_at">) {
  return withMutableState((state) => createDangerZoneForCaseInState(state, input));
}

export async function updateDangerZone(id: string, patch: Partial<Omit<DangerZone, "id" | "created_at">>) {
  return withMutableState((state) => {
    const zone = state.danger_zones.find((item) => item.id === id);
    if (!zone) throw new Error("Danger zone not found.");
    Object.assign(zone, patch, { updated_at: nowIso() });
    bus.emit({ type: "zone.computed", zone, mode: inferZoneMode(zone) });
    return zone;
  });
}
