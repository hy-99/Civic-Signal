import { promises as fs } from "node:fs";
import path from "node:path";

import { DEMO_IMAGE_DIR, DEMO_STATE_PATH } from "@/lib/constants";
import { createInitialState } from "@/lib/mock-data";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { CivicState } from "@/lib/types";

const tableNames = [
  "profiles",
  "reports",
  "public_signals",
  "risk_clusters",
  "cluster_items",
  "report_votes",
  "cluster_votes",
  "report_updates",
  "source_feeds",
  "moderation_actions",
  "geocode_cache",
  "ai_cache",
  "categories",
] as const;

const rootDir = process.cwd();

async function ensureDemoDirectories() {
  await fs.mkdir(path.join(rootDir, path.dirname(DEMO_STATE_PATH)), { recursive: true });
  await fs.mkdir(path.join(rootDir, DEMO_IMAGE_DIR), { recursive: true });
}

export async function readDemoState(): Promise<CivicState> {
  await ensureDemoDirectories();
  const statePath = path.join(rootDir, DEMO_STATE_PATH);

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw) as CivicState;
  } catch {
    const initial = createInitialState();
    await fs.writeFile(statePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

export async function writeDemoState(state: CivicState) {
  await ensureDemoDirectories();
  const statePath = path.join(rootDir, DEMO_STATE_PATH);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

export async function resetDemoState() {
  const initial = createInitialState();
  await writeDemoState(initial);
  return initial;
}

async function tryReadSupabaseState(): Promise<CivicState | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const entries = await Promise.all(
      tableNames.map(async (table) => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        return [table, data ?? []] as const;
      }),
    );

    return Object.fromEntries(entries) as unknown as CivicState;
  } catch {
    return null;
  }
}

async function tryWriteSupabaseState(state: CivicState) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  try {
    for (const table of tableNames) {
      const rows = state[table];
      if (rows.length) {
        const { error } = await supabase.from(table).upsert(rows as never[]);
        if (error) throw error;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function loadState() {
  const supabaseState = await tryReadSupabaseState();
  if (supabaseState) return supabaseState;
  return readDemoState();
}

export async function saveState(state: CivicState) {
  const wroteSupabase = await tryWriteSupabaseState(state);
  if (!wroteSupabase) {
    await writeDemoState(state);
  }
}

export async function withMutableState<T>(mutator: (draft: CivicState) => Promise<T> | T) {
  const current = await loadState();
  const draft = structuredClone(current);
  const result = await mutator(draft);
  await saveState(draft);
  return result;
}
