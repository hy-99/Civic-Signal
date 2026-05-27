import type { SourceFeed } from "@/lib/types";

import type { FeedSignalCandidate } from "@/services/ingestion/types";
import { cleanText, normalizePublishedAt } from "@/services/ingestion/parsers/shared";

export function parseUsgsFeed(raw: string, feed: SourceFeed): FeedSignalCandidate[] {
  const payload = JSON.parse(raw) as {
    features?: Array<{
      id?: string;
      properties?: { mag?: number; place?: string; title?: string; time?: number; detail?: string };
      geometry?: { coordinates?: number[] };
    }>;
  };

  return (payload.features || [])
    .map((feature) => {
      const longitude = Number(feature.geometry?.coordinates?.[0]);
      const latitude = Number(feature.geometry?.coordinates?.[1]);
      const magnitude = Number(feature.properties?.mag);
      const place = cleanText(feature.properties?.place) || feed.default_city || "Unknown location";
      const title =
        cleanText(feature.properties?.title) ||
        (Number.isFinite(magnitude) ? `M ${magnitude.toFixed(1)} - ${place}` : `Earthquake near ${place}`);

      return {
        external_id: cleanText(feature.id) || null,
        title,
        text: cleanText(`${place}${feature.properties?.detail ? ` ${feature.properties.detail}` : ""}`) || null,
        category: "building_structure_concern",
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        address_text: place,
        published_at: normalizePublishedAt(feature.properties?.time),
      } satisfies FeedSignalCandidate;
    })
    .filter((item) => item.external_id && item.title);
}
