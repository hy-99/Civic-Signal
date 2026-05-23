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

async function geocodeWithNominatim(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "CivicSignal/1.0 (+https://github.com/hy-99/Civic-Signal)",
      Accept: "application/json",
    },
  });

  if (!response.ok) return null;
  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const hit = results[0];
  if (!hit) return null;

  return {
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    formatted_address: hit.display_name,
    provider: "nominatim",
    raw_json: hit,
  };
}

export async function geocodeAddress(query: string) {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Address query is required.");

  const cached = await getCachedGeocode(trimmed);
  if (cached) return cached;

  const env = getEnv();
  const fallback = deterministicFallback(trimmed);

  if (!env.geocoding_api_key || !env.geocoding_provider) {
    const nominatim = await geocodeWithNominatim(trimmed);
    if (nominatim) return saveGeocodeCache({ query: trimmed, ...nominatim });
    return saveGeocodeCache({ query: trimmed, ...fallback });
  }

  const nominatim = await geocodeWithNominatim(trimmed);
  if (nominatim) return saveGeocodeCache({ query: trimmed, ...nominatim, provider: env.geocoding_provider });

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
