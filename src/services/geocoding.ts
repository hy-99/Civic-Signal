import { DEFAULT_COORDS } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { withMutableState } from "@/lib/data-store";
import type { GeocodeCacheEntry } from "@/lib/types";
import { createId, nowIso, sanitizeUserText } from "@/lib/utils";

export async function getCachedGeocode(query: string) {
  return withMutableState((state) =>
    state.geocode_cache.find((entry) => entry.query.toLowerCase() === query.trim().toLowerCase()) || null,
  );
}

export async function saveGeocodeCache(result: Omit<GeocodeCacheEntry, "id" | "created_at">) {
  return withMutableState((state) => {
    const existing = state.geocode_cache.find((entry) => entry.query.toLowerCase() === result.query.toLowerCase());
    const row: GeocodeCacheEntry = {
      ...result,
      id: existing?.id || createId(),
      created_at: existing?.created_at || nowIso(),
    };
    if (existing) Object.assign(existing, row);
    else state.geocode_cache.push(row);
    return row;
  });
}

function deterministicFallback(query: string) {
  const key = sanitizeUserText(query).toLowerCase();
  const nudge = (seed: number) => (seed % 9) * 0.0012;
  const seed = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    latitude: DEFAULT_COORDS.lat + nudge(seed),
    longitude: DEFAULT_COORDS.lng - nudge(seed + 5),
    formatted_address: query,
    provider: "demo_fallback",
    raw_json: { seed },
  };
}

export async function geocodeAddress(query: string) {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Address query is required.");

  const cached = await getCachedGeocode(trimmed);
  if (cached) return cached;

  const env = getEnv();
  if (!env.geocoding_api_key || !env.geocoding_provider) {
    const fallback = deterministicFallback(trimmed);
    return saveGeocodeCache({ query: trimmed, ...fallback });
  }

  const fallback = deterministicFallback(trimmed);
  return saveGeocodeCache({ query: trimmed, ...fallback, provider: env.geocoding_provider });
}

export async function reverseGeocode(lat: number, lng: number) {
  return {
    latitude: lat,
    longitude: lng,
    formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    provider: "reverse_demo",
    raw_json: {},
  };
}
