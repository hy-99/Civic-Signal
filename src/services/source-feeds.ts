import { loadState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import type { SourceFeed } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";
import { buildDefaultDemoFeeds, previewFeed, scanFeed, shouldSeedDefaultDemoFeeds } from "@/services/ingestion";

async function ensureDefaultSourceFeeds() {
  if (!shouldSeedDefaultDemoFeeds()) return;

  const state = await loadState();
  const defaults = buildDefaultDemoFeeds();
  const missing = defaults.filter((defaultFeed) => !state.source_feeds.some((feed) => feed.url === defaultFeed.url));
  const legacyMocks = state.source_feeds.filter((feed) => feed.url.includes("example.org") && feed.is_active);

  if (!missing.length && !legacyMocks.length) return;

  await withMutableState((draft) => {
    const timestamp = nowIso();

    for (const feed of draft.source_feeds) {
      if (feed.url.includes("example.org") && feed.is_active) {
        feed.is_active = false;
        feed.updated_at = timestamp;
      }
    }

    for (const defaultFeed of defaults) {
      if (draft.source_feeds.some((feed) => feed.url === defaultFeed.url)) continue;
      draft.source_feeds.push({
        ...defaultFeed,
        id: createId(),
        is_active: true,
        last_checked_at: null,
        last_success_at: null,
        last_error: null,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  });
}

export async function getSourceFeeds() {
  await ensureDefaultSourceFeeds();
  const state = await loadState();
  return state.source_feeds.sort((a, b) => a.name.localeCompare(b.name));
}

type CreateSourceFeedInput = Omit<
  SourceFeed,
  "id" | "created_at" | "updated_at" | "last_checked_at" | "last_success_at" | "last_error" | "default_city" | "default_latitude" | "default_longitude"
> & {
  default_city?: string | null;
  default_latitude?: number | null;
  default_longitude?: number | null;
};

export async function createSourceFeed(input: CreateSourceFeedInput) {
  return withMutableState((state) => {
    const timestamp = nowIso();
    const feed: SourceFeed = {
      ...input,
      default_city: input.default_city ?? null,
      default_latitude: input.default_latitude ?? null,
      default_longitude: input.default_longitude ?? null,
      id: createId(),
      last_checked_at: null,
      last_success_at: null,
      last_error: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    state.source_feeds.push(feed);
    return feed;
  });
}

export async function updateSourceFeed(id: string, input: Partial<SourceFeed>) {
  return withMutableState((state) => {
    const feed = state.source_feeds.find((item) => item.id === id);
    if (!feed) throw new Error("Source feed not found.");
    Object.assign(feed, input, { updated_at: nowIso() });
    return feed;
  });
}

export async function parseFeedItems(raw: unknown) {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

export async function testSourceFeed(id: string) {
  await ensureDefaultSourceFeeds();
  const state = await loadState();
  const feed = state.source_feeds.find((item) => item.id === id);
  if (!feed) throw new Error("Source feed not found.");
  return previewFeed(feed);
}

export async function scanSourceFeed(id: string) {
  await ensureDefaultSourceFeeds();
  const state = await loadState();
  const feed = state.source_feeds.find((item) => item.id === id);
  if (!feed) throw new Error("Source feed not found.");

  const result = await scanFeed(feed);
  const timestamp = nowIso();
  const updates: Partial<SourceFeed> = {
    last_checked_at: timestamp,
    last_error: result.errors[0] || null,
  };

  if (!result.errors.length) {
    updates.last_success_at = timestamp;
  }

  await updateSourceFeed(id, updates);
  bus.emit({ type: "feed.scanned", feed_id: feed.id, items_added: result.imported_count });
  return result;
}
