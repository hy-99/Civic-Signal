import { getSourceFeeds, scanSourceFeed } from "@/services/source-feeds";

export async function runFeedScanJob(input?: { feed_id?: string }) {
  const feeds = input?.feed_id ? (await getSourceFeeds()).filter((feed) => feed.id === input.feed_id) : (await getSourceFeeds()).filter((feed) => feed.is_active);
  let imported = 0;
  let errors = 0;

  for (const feed of feeds) {
    try {
      const result = await scanSourceFeed(feed.id);
      imported += result.imported_count;
    } catch {
      errors += 1;
    }
  }

  return {
    processed: feeds.length,
    imported,
    errors,
  };
}
