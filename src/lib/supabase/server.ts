import { createClient } from "@supabase/supabase-js";

import { getEnv, hasSupabaseConfig } from "@/lib/env";

export function getSupabaseAdminClient() {
  if (!hasSupabaseConfig()) return null;
  const env = getEnv();
  return createClient(env.next_public_supabase_url, env.supabase_service_role_key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabasePublicServerClient() {
  if (!hasSupabaseConfig()) return null;
  const env = getEnv();
  return createClient(env.next_public_supabase_url, env.next_public_supabase_anon_key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
