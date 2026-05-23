"use client";

import { createClient } from "@supabase/supabase-js";

import { getEnv, hasSupabaseConfig } from "@/lib/env";

export function createBrowserSupabaseClient() {
  if (!hasSupabaseConfig()) return null;
  const env = getEnv();
  return createClient(env.next_public_supabase_url, env.next_public_supabase_anon_key);
}
