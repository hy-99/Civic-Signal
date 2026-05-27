import type { SourceFeed } from "@/lib/types";

import type { FeedSignalCandidate } from "@/services/ingestion/types";
import { centroidFromGeometry, cleanText, inferCategoryFromText, normalizePublishedAt } from "@/services/ingestion/parsers/shared";

export function parseNwsFeed(raw: string, feed: SourceFeed): FeedSignalCandidate[] {
  const payload = JSON.parse(raw) as {
    features?: Array<{
      id?: string;
      geometry?: unknown;
      properties?: {
        event?: string;
        headline?: string;
        description?: string;
        areaDesc?: string;
        severity?: string;
        sent?: string;
        effective?: string;
        onset?: string;
      };
    }>;
  };

  return (payload.features || [])
    .map((feature) => {
      const areaDesc = cleanText(feature.properties?.areaDesc) || feed.default_city || "Weather alert area";
      const title = cleanText(feature.properties?.headline) || cleanText(feature.properties?.event) || "National Weather Service alert";
      const location = centroidFromGeometry(feature.geometry);

      return {
        external_id: cleanText(feature.id) || null,
        title,
        text: cleanText(`${feature.properties?.description || ""} ${areaDesc}`) || null,
        category: inferCategoryFromText(feature.properties?.event, feature.properties?.headline, feature.properties?.description, areaDesc),
        latitude: location.latitude,
        longitude: location.longitude,
        address_text: areaDesc,
        published_at: normalizePublishedAt(feature.properties?.sent || feature.properties?.effective || feature.properties?.onset),
      } satisfies FeedSignalCandidate;
    })
    .filter((item) => item.external_id && item.title);
}
