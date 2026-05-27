import type { SourceFeed } from "@/lib/types";

import type { FeedSignalCandidate } from "@/services/ingestion/types";
import { normalizePublishedAt } from "@/services/ingestion/parsers/shared";

const HAZARDOUS_WIND_SPEED_KPH = 55;
const HAZARDOUS_WEATHER_CODES = new Set([65, 67, 75, 77, 82, 86, 95, 96, 99]);

export function parseOpenMeteoFeed(raw: string, feed: SourceFeed): FeedSignalCandidate[] {
  const payload = JSON.parse(raw) as {
    current?: {
      time?: string;
      temperature_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };

  const current = payload.current;
  if (!current) return [];

  const weatherCode = Number(current.weather_code);
  const windSpeed = Number(current.wind_speed_10m);
  const hazardousWind = Number.isFinite(windSpeed) && windSpeed >= HAZARDOUS_WIND_SPEED_KPH;
  const hazardousCode = Number.isFinite(weatherCode) && HAZARDOUS_WEATHER_CODES.has(weatherCode);

  if (!hazardousWind && !hazardousCode) return [];

  const area = feed.default_city || feed.name;
  const title = hazardousWind ? `High wind conditions near ${area}` : `Hazardous weather conditions near ${area}`;
  const details = [
    Number.isFinite(current.temperature_2m) ? `Temperature ${current.temperature_2m}C.` : null,
    Number.isFinite(windSpeed) ? `Wind ${windSpeed} km/h.` : null,
    Number.isFinite(weatherCode) ? `Weather code ${weatherCode}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    {
      external_id: `open-meteo:${feed.id}:${current.time || "current"}:${Number.isFinite(weatherCode) ? weatherCode : "na"}:${Number.isFinite(windSpeed) ? Math.round(windSpeed) : "na"}`,
      title,
      text: details || null,
      category: "weather_damage",
      latitude: feed.default_latitude ?? null,
      longitude: feed.default_longitude ?? null,
      address_text: feed.default_city ?? null,
      published_at: normalizePublishedAt(current.time),
    },
  ];
}
