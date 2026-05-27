import { getEnv, isDemoMode } from "@/lib/env";
import type { SourceFeed } from "@/lib/types";
import { createPublicSignal } from "@/services/signals";

import { getExistingExternalIds } from "@/services/ingestion/dedup";
import { resolveFeedSignalLocation } from "@/services/ingestion/geocode-from-feed";
import { parseNwsFeed } from "@/services/ingestion/parsers/nws";
import { parseOpenMeteoFeed } from "@/services/ingestion/parsers/open-meteo";
import { parseRssFeed } from "@/services/ingestion/parsers/rss";
import { parseUsgsFeed } from "@/services/ingestion/parsers/usgs";
import type { FeedKind, FeedPreviewResult, FeedScanResult, FeedSignalCandidate } from "@/services/ingestion/types";

function buildUserAgent() {
  const contact = getEnv().civicsignal_contact.trim();
  return `CivicSignal/1.0 (hackathon-demo; contact: ${contact})`;
}

function resolveFeedKind(feed: SourceFeed): FeedKind | null {
  const sourceType = feed.source_type.toLowerCase();
  if (sourceType === "usgs" || sourceType === "nws" || sourceType === "open_meteo" || sourceType === "rss") {
    return sourceType;
  }

  const url = feed.url.toLowerCase();
  if (url.includes("earthquake.usgs.gov")) return "usgs";
  if (url.includes("api.weather.gov/alerts")) return "nws";
  if (url.includes("api.open-meteo.com")) return "open_meteo";
  if (url.includes("rss") || url.endsWith(".xml") || url.includes("/feed")) return "rss";
  return null;
}

async function fetchFeedBody(feed: SourceFeed) {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json, application/geo+json, application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": buildUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed with ${response.status}.`);
  }

  return response.text();
}

function parseFeedCandidates(feed: SourceFeed, raw: string) {
  const kind = resolveFeedKind(feed);
  if (!kind) {
    throw new Error("Unsupported source feed.");
  }

  switch (kind) {
    case "usgs":
      return parseUsgsFeed(raw, feed);
    case "nws":
      return parseNwsFeed(raw, feed);
    case "open_meteo":
      return parseOpenMeteoFeed(raw, feed);
    case "rss":
      return parseRssFeed(raw, feed);
  }
}

async function loadFeedCandidates(feed: SourceFeed) {
  try {
    const raw = await fetchFeedBody(feed);
    const preview_items = parseFeedCandidates(feed, raw);
    return {
      preview_items,
      errors: [] as string[],
    };
  } catch (error) {
    return {
      preview_items: [] as FeedSignalCandidate[],
      errors: [error instanceof Error ? error.message : "Unable to scan feed."],
    };
  }
}

export function buildDefaultDemoFeeds() {
  const env = getEnv();
  const latitude = env.next_public_default_lat;
  const longitude = env.next_public_default_lng;
  const city = env.next_public_default_city;
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(
    String(longitude),
  )}&current=temperature_2m,weather_code,wind_speed_10m`;

  return [
    {
      name: "USGS Significant Earthquakes",
      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson",
      source_type: "usgs" as const,
      default_city: city,
      default_latitude: latitude,
      default_longitude: longitude,
      trust_level: 90,
      keywords: ["earthquake", "seismic"],
    },
    {
      name: "NWS Active Alerts (US)",
      url: "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
      source_type: "nws" as const,
      default_city: city,
      default_latitude: latitude,
      default_longitude: longitude,
      trust_level: 92,
      keywords: ["warning", "watch", "advisory"],
    },
    {
      name: "Open-Meteo Default City",
      url: openMeteoUrl,
      source_type: "open_meteo" as const,
      default_city: city,
      default_latitude: latitude,
      default_longitude: longitude,
      trust_level: 68,
      keywords: ["wind", "weather"],
    },
    {
      name: "NWS Bay Area RSS",
      url: "https://www.weather.gov/rss_page.php?site_name=mtr",
      source_type: "rss" as const,
      default_city: city,
      default_latitude: latitude,
      default_longitude: longitude,
      trust_level: 74,
      keywords: ["weather", "hazard"],
    },
  ];
}

export async function previewFeed(feed: SourceFeed): Promise<FeedPreviewResult> {
  const { preview_items, errors } = await loadFeedCandidates(feed);
  const resolved = await Promise.all(preview_items.map((item) => resolveFeedSignalLocation(feed, item, { preview: true })));

  return {
    feed,
    preview_items: resolved,
    fetched_count: resolved.length,
    mode: "live_preview",
    errors,
  };
}

export async function scanFeed(feed: SourceFeed): Promise<FeedScanResult> {
  const preview = await previewFeed(feed);
  const existingExternalIds = await getExistingExternalIds(feed.id);
  const imported = [];
  let duplicates_count = 0;

  for (const candidate of preview.preview_items) {
    if (candidate.external_id && existingExternalIds.has(candidate.external_id)) {
      duplicates_count += 1;
      continue;
    }

    const item = await resolveFeedSignalLocation(feed, candidate);
    const signal = await createPublicSignal({
      source_feed_id: feed.id,
      source_name: feed.name,
      source_type: feed.source_type,
      source_url: feed.url,
      external_id: item.external_id,
      title: item.title,
      text: item.text,
      category: item.category,
      latitude: item.latitude,
      longitude: item.longitude,
      address_text: item.address_text,
      published_at: item.published_at,
    });

    imported.push(signal);
    if (item.external_id) {
      existingExternalIds.add(item.external_id);
    }
  }

  return {
    imported_count: imported.length,
    duplicates_count,
    fetched_count: preview.fetched_count,
    items: imported,
    errors: preview.errors,
  };
}

export function shouldSeedDefaultDemoFeeds() {
  return isDemoMode();
}
