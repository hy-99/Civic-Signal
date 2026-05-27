import type { SourceFeed } from "@/lib/types";
import { geocodeAddress } from "@/services/geocoding";

import type { FeedSignalCandidate } from "@/services/ingestion/types";

export async function resolveFeedSignalLocation(feed: SourceFeed, item: FeedSignalCandidate, options?: { preview?: boolean }) {
  let latitude = item.latitude;
  let longitude = item.longitude;
  let address_text = item.address_text;

  if (latitude === null || longitude === null) {
    latitude = feed.default_latitude ?? null;
    longitude = feed.default_longitude ?? null;
  }

  if (!address_text) {
    address_text = feed.default_city ?? null;
  }

  if (!options?.preview && (latitude === null || longitude === null) && address_text) {
    try {
      const geocoded = await geocodeAddress(address_text);
      latitude = geocoded.latitude;
      longitude = geocoded.longitude;
      address_text = geocoded.formatted_address || address_text;
    } catch {
      latitude = latitude ?? null;
      longitude = longitude ?? null;
    }
  }

  return {
    ...item,
    latitude,
    longitude,
    address_text,
  };
}
