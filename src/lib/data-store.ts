import { promises as fs } from "node:fs";
import path from "node:path";
import { isMainThread, threadId } from "node:worker_threads";

import { DEMO_IMAGE_DIR, DEMO_STATE_PATH } from "@/lib/constants";
import { isDemoMode } from "@/lib/env";
import { createInitialState } from "@/lib/mock-data";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { CivicState } from "@/lib/types";

const tableNames = [
  "profiles",
  "reports",
  "public_signals",
  "risk_clusters",
  "incident_cases",
  "danger_zones",
  "case_events",
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
const isNodeTestRuntime =
  process.argv.includes("--test") ||
  process.argv.some((arg) => arg.includes("src/tests")) ||
  process.env.NODE_ENV === "test" ||
  process.env.npm_lifecycle_event === "test";

function getDemoStatePath() {
  if (!isNodeTestRuntime) return DEMO_STATE_PATH;
  const threadSuffix = isMainThread ? "main" : `thread-${threadId}`;
  const suffix = process.env.CIVICSIGNAL_TEST_STATE_SUFFIX || `${process.pid}-${threadSuffix}`;
  return DEMO_STATE_PATH.replace(/\.json$/, `.${suffix}.json`);
}

function normalizeState(state: Partial<CivicState>): CivicState {
  const initial = createInitialState();
  return {
    profiles: state.profiles ?? initial.profiles,
    reports: state.reports ?? initial.reports,
    public_signals: state.public_signals ?? initial.public_signals,
    risk_clusters: state.risk_clusters ?? initial.risk_clusters,
    incident_cases: state.incident_cases ?? initial.incident_cases,
    danger_zones: state.danger_zones ?? initial.danger_zones,
    case_events: state.case_events ?? initial.case_events,
    cluster_items: state.cluster_items ?? initial.cluster_items,
    report_votes: state.report_votes ?? initial.report_votes,
    cluster_votes: state.cluster_votes ?? initial.cluster_votes,
    report_updates: state.report_updates ?? initial.report_updates,
    source_feeds: state.source_feeds ?? initial.source_feeds,
    moderation_actions: state.moderation_actions ?? initial.moderation_actions,
    geocode_cache: state.geocode_cache ?? [],
    ai_cache: state.ai_cache ?? [],
    categories: state.categories ?? initial.categories,
  };
}

async function ensureDemoDirectories() {
  await fs.mkdir(path.join(rootDir, path.dirname(getDemoStatePath())), { recursive: true });
  await fs.mkdir(path.join(rootDir, DEMO_IMAGE_DIR), { recursive: true });
}

export async function readDemoState(): Promise<CivicState> {
  await ensureDemoDirectories();
  const statePath = path.join(rootDir, getDemoStatePath());

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return normalizeState(JSON.parse(raw) as Partial<CivicState>);
  } catch {
    const initial = createInitialState();
    await fs.writeFile(statePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

export async function writeDemoState(state: CivicState) {
  await ensureDemoDirectories();
  const statePath = path.join(rootDir, getDemoStatePath());
  const tempPath = `${statePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tempPath, statePath);
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

    return normalizeState(Object.fromEntries(entries) as Partial<CivicState>);
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
  if (isDemoMode()) {
    return readDemoState();
  }

  const supabaseState = await tryReadSupabaseState();
  if (supabaseState) return supabaseState;
  return readDemoState();
}

export async function saveState(state: CivicState) {
  if (isDemoMode()) {
    await writeDemoState(state);
    return;
  }

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
