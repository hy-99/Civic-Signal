import { APP_ENV_DEFAULT, DEFAULT_COORDS } from "@/lib/constants";

export function getEnv() {
  return {
    app_env: process.env.APP_ENV || APP_ENV_DEFAULT,
    next_public_demo_mode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
    next_public_supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    next_public_supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    next_public_map_style_url: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "",
    next_public_default_lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT || DEFAULT_COORDS.lat),
    next_public_default_lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG || DEFAULT_COORDS.lng),
    next_public_default_city: process.env.NEXT_PUBLIC_DEFAULT_CITY || DEFAULT_COORDS.city,
    openai_api_key: process.env.OPENAI_API_KEY || "",
    groq_api_key: process.env.GROQ_API_KEY || "",
    news_api_key: process.env.NEWS_API_KEY || "",
    geocoding_provider: process.env.GEOCODING_PROVIDER || "",
    geocoding_api_key: process.env.GEOCODING_API_KEY || "",
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

export function hasOpenAIConfig() {
  return Boolean(getEnv().openai_api_key);
}

export function hasGroqConfig() {
  return Boolean(getEnv().groq_api_key);
}

