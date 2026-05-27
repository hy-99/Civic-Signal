import type { SourceFeed } from "@/lib/types";

import type { FeedSignalCandidate } from "@/services/ingestion/types";
import { cleanText, inferCategoryFromText, normalizePublishedAt } from "@/services/ingestion/parsers/shared";

function extractTag(block: string, tag: string) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  return cleanText(block.match(pattern)?.[1] || "");
}

function buildExternalId(block: string, title: string, published_at: string | null) {
  return extractTag(block, "guid") || extractTag(block, "link") || [title, published_at].filter(Boolean).join(":") || null;
}

export function parseRssFeed(raw: string, feed: SourceFeed): FeedSignalCandidate[] {
  const items = [...raw.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];

  return items
    .map((match) => {
      const block = match[1] || "";
      const title = extractTag(block, "title");
      const description = extractTag(block, "description");
      const published_at = normalizePublishedAt(extractTag(block, "pubDate"));

      return {
        external_id: buildExternalId(block, title, published_at),
        title,
        text: description || null,
        category: inferCategoryFromText(title, description, feed.name, feed.keywords.join(" ")),
        latitude: feed.default_latitude ?? null,
        longitude: feed.default_longitude ?? null,
        address_text: feed.default_city ?? null,
        published_at,
      } satisfies FeedSignalCandidate;
    })
    .filter((item) => item.external_id && item.title);
}
