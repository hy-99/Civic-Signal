import type { PublicSignalView, ReportCategoryKey, SourceFeed } from "@/lib/types";

export type FeedKind = "usgs" | "nws" | "open_meteo" | "rss";

export interface FeedSignalCandidate {
  external_id: string | null;
  title: string;
  text: string | null;
  category: ReportCategoryKey;
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
  published_at: string | null;
}

export interface FeedPreviewResult {
  feed: SourceFeed;
  preview_items: FeedSignalCandidate[];
  fetched_count: number;
  mode: "live_preview";
  errors: string[];
}

export interface FeedScanResult {
  imported_count: number;
  duplicates_count: number;
  fetched_count: number;
  items: PublicSignalView[];
  errors: string[];
}
