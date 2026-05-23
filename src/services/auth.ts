import { cookies } from "next/headers";

import { DEMO_PERSONAS, DEMO_SESSION_COOKIE } from "@/lib/constants";
import { hasSupabaseConfig, isDemoMode } from "@/lib/env";
import { withMutableState } from "@/lib/data-store";
import { getSupabasePublicServerClient } from "@/lib/supabase/server";
import type { AuthViewer, Profile, UserRole } from "@/lib/types";
import { createId, nowIso, slugify } from "@/lib/utils";

async function setSessionCookie(profile: Profile) {
  const cookieStore = await cookies();
  cookieStore.set(
    DEMO_SESSION_COOKIE,
    JSON.stringify({
      user_id: profile.id,
      role: profile.role,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  );
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_SESSION_COOKIE);
}

async function ensureProfileFromAuthUser(input: { id: string; email: string; display_name?: string; home_city?: string | null }) {
  return withMutableState((state) => {
    const existing = state.profiles.find((profile) => profile.id === input.id);
    if (existing) return existing;
    const next: Profile = {
      id: input.id,
      display_name: input.display_name || input.email.split("@")[0],
      username: slugify(input.email.split("@")[0]) || `user-${state.profiles.length + 1}`,
      role: "user",
      trust_score: 50,
      home_city: input.home_city || null,
      avatar_url: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      demo_email: isDemoMode() ? input.email : null,
      demo_password: null,
    };
    state.profiles.push(next);
    return next;
  });
}

export async function signIn(input: { email: string; password: string; demo_profile_id?: string }) {
  if (isDemoMode()) {
    const personaId = input.demo_profile_id || DEMO_PERSONAS.find((persona) => persona.email === input.email && persona.password === input.password)?.id;
    if (!personaId) throw new Error("Invalid demo credentials.");

    const profile = await withMutableState((state) => state.profiles.find((item) => item.id === personaId) || null);
    if (!profile) throw new Error("Demo profile not found.");
    await setSessionCookie(profile);
    return profile;
  }

  if (!hasSupabaseConfig()) throw new Error("Supabase auth is unavailable.");
  const supabase = getSupabasePublicServerClient();
  if (!supabase) throw new Error("Supabase auth is unavailable.");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.user) throw new Error(error?.message || "Unable to sign in.");

  const profile = await ensureProfileFromAuthUser({
    id: data.user.id,
    email: data.user.email || input.email,
    display_name: data.user.user_metadata?.display_name as string | undefined,
    home_city: (data.user.user_metadata?.home_city as string | undefined) || null,
  });
  await setSessionCookie(profile);
  return profile;
}

export async function signUp(input: { display_name: string; email: string; password: string; home_city?: string | null }) {
  if (isDemoMode()) {
    return withMutableState(async (state) => {
      if (state.profiles.some((profile) => profile.demo_email?.toLowerCase() === input.email.toLowerCase())) {
        throw new Error("A demo account with that email already exists.");
      }
      const profile: Profile = {
        id: createId(),
        display_name: input.display_name,
        username: slugify(input.display_name) || `resident-${state.profiles.length + 1}`,
        role: "user",
        trust_score: 50,
        home_city: input.home_city || null,
        avatar_url: null,
        created_at: nowIso(),
        updated_at: nowIso(),
        demo_email: input.email,
        demo_password: input.password,
      };
      state.profiles.push(profile);
      await setSessionCookie(profile);
      return profile;
    });
  }

  const supabase = getSupabasePublicServerClient();
  if (!supabase) throw new Error("Supabase auth is unavailable.");
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        display_name: input.display_name,
        home_city: input.home_city || null,
      },
    },
  });
  if (error || !data.user) throw new Error(error?.message || "Unable to create account.");

  const profile = await ensureProfileFromAuthUser({
    id: data.user.id,
    email: data.user.email || input.email,
    display_name: input.display_name,
    home_city: input.home_city || null,
  });
  await setSessionCookie(profile);
  return profile;
}

async function demoResidentViewer(): Promise<AuthViewer | null> {
  if (!isDemoMode()) return null;
  const resident = DEMO_PERSONAS[0];
  const profile = await withMutableState((state) => state.profiles.find((item) => item.id === resident.id) || null);
  if (!profile) return null;
  return {
    id: profile.id,
    role: profile.role,
    display_name: profile.display_name,
    username: profile.username,
    home_city: profile.home_city,
    is_demo_mode: true,
  };
}

export async function getCurrentViewer(): Promise<AuthViewer | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (!session) return demoResidentViewer();

  try {
    const parsed = JSON.parse(session) as { user_id: string; role: UserRole };
    const profile = await withMutableState((state) => state.profiles.find((item) => item.id === parsed.user_id) || null);
    if (!profile) return demoResidentViewer();
    return {
      id: profile.id,
      role: profile.role,
      display_name: profile.display_name,
      username: profile.username,
      home_city: profile.home_city,
      is_demo_mode: isDemoMode(),
    };
  } catch {
    return demoResidentViewer();
  }
}

export async function requireViewer() {
  const viewer = await getCurrentViewer();
  if (!viewer) throw new Error("Login required.");
  return viewer;
}

export async function requireRole(roles: UserRole[]) {
  const viewer = await requireViewer();
  if (isDemoMode()) return viewer;
  if (!roles.includes(viewer.role)) throw new Error("Unauthorized.");
  return viewer;
}
