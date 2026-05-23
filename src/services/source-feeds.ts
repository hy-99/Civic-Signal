import { loadState, withMutableState } from "@/lib/data-store";
import type { SourceFeed } from "@/lib/types";
import { createPublicSignal } from "@/services/signals";
import { createId, nowIso } from "@/lib/utils";

function makeMockItems(feed: SourceFeed) {
  const common = {
    source_name: feed.name,
    source_type: feed.source_type,
    source_url: feed.url,
    address_text: feed.default_city || "North Lake",
    latitude: feed.default_latitude,
    longitude: feed.default_longitude,
  };

  if (feed.source_type === "weather") {
    return [
      {
        ...common,
        title: "High wind advisory across the North Lake corridor",
        text: "Wind gusts may affect trees, overhead lines, and visibility through tonight.",
        category: "weather_damage" as const,
      },
    ];
  }

  if (feed.source_type === "traffic" || feed.source_type === "city_alert") {
    return [
      {
        ...common,
        title: "Library event crowd guidance",
        text: "Event staff requested that attendees keep the public entrance and accessible path clear.",
        category: "crowd_safety" as const,
      },
    ];
  }

  return [
    {
      ...common,
      title: `Mock scan from ${feed.name}`,
      text: "This demo signal represents a place-based public-space condition imported through the feed admin shell.",
      category: "school_area_concern" as const,
    },
  ];
}

export async function getSourceFeeds() {
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
    const feed: SourceFeed = {
      ...input,
      default_city: input.default_city ?? null,
      default_latitude: input.default_latitude ?? null,
      default_longitude: input.default_longitude ?? null,
      id: createId(),
      last_checked_at: null,
      last_success_at: null,
      last_error: null,
      created_at: nowIso(),
      updated_at: nowIso(),
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

export async function importFeedItems(items: Array<Parameters<typeof createPublicSignal>[0]>) {
  const imported = [];
  for (const item of items) {
    imported.push(await createPublicSignal(item));
  }
  return imported;
}

export async function testSourceFeed(id: string) {
  const state = await loadState();
  const feed = state.source_feeds.find((item) => item.id === id);
  if (!feed) throw new Error("Source feed not found.");
  return {
    feed,
    preview_items: makeMockItems(feed),
    mode: "mock_scan",
  };
}

export async function scanSourceFeed(id: string) {
  const state = await loadState();
  const feed = state.source_feeds.find((item) => item.id === id);
  if (!feed) throw new Error("Source feed not found.");
  const items = makeMockItems(feed);
  const imported = await importFeedItems(items);
  await updateSourceFeed(id, {
    last_checked_at: nowIso(),
    last_success_at: nowIso(),
    last_error: null,
  });
  return {
    imported_count: imported.length,
    items: imported,
    mode: "mock_scan",
  };
}
