import { APP_ENV_DEFAULT, DEFAULT_COORDS } from "@/lib/constants";

export function getEnv() {
  return {
    app_env: process.env.APP_ENV || APP_ENV_DEFAULT,
    next_public_demo_mode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
    next_public_supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    next_public_supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    next_public_map_style_url: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "",
    next_public_satellite_tile_url: process.env.NEXT_PUBLIC_SATELLITE_TILE_URL || "",
    next_public_terrain_tile_url: process.env.NEXT_PUBLIC_TERRAIN_TILE_URL || "",
    next_public_default_lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || DEFAULT_COORDS.lat),
    next_public_default_lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || DEFAULT_COORDS.lng),
    next_public_default_city: process.env.NEXT_PUBLIC_DEFAULT_CITY || DEFAULT_COORDS.city,
    gemini_api_key: process.env.GEMINI_API_KEY || "",
    gemini_model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    gemini_vision_model: process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    gemini_embedding_model: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
    civicsignal_contact: process.env.CIVICSIGNAL_CONTACT || "",
    news_api_key: process.env.NEWS_API_KEY || "",
    geocoding_provider: process.env.GEOCODING_PROVIDER || "",
    geocoding_api_key: process.env.GEOCODING_API_KEY || "",
    auto_approve_zones: process.env.AUTO_APPROVE_ZONES || "",
  };
}

export function hasSupabaseConfig() {
  const env = getEnv();
  return Boolean(env.next_public_supabase_url && env.next_public_supabase_anon_key && env.supabase_service_role_key);
}

export function isDemoMode() {
  const env = getEnv();
  return env.next_public_demo_mode || !hasSupabaseConfig();
}

export function hasMapConfig() {
  return Boolean(getEnv().next_public_map_style_url);
}

export function hasGeminiConfig() {
  return Boolean(getEnv().gemini_api_key);
}

export function shouldAutoApproveZones() {
  const value = getEnv().auto_approve_zones.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return isDemoMode();
}
