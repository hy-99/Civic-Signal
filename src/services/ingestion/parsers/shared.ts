import type { ReportCategoryKey } from "@/lib/types";

function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return decodeXmlEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizePublishedAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

export function inferCategoryFromText(...segments: Array<string | null | undefined>): ReportCategoryKey {
  const text = segments
    .map((segment) => cleanText(segment).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (/(flood|flash flood|storm surge|inundation)/.test(text)) return "flooding";
  if (/(fire|smoke|wildfire|red flag)/.test(text)) return "fire_smoke";
  if (/(power outage|blackout|downed line|utility)/.test(text)) return "power_outage";
  if (/(tree|branch|limb)/.test(text)) return "fallen_tree";
  if (/(pothole|sinkhole|road damage)/.test(text)) return "road_hazard";
  if (/(road|street|traffic|closure|blocked|obstruction)/.test(text)) return "traffic_obstruction";
  if (/(crowd|stampede|overcapacity)/.test(text)) return "crowd_safety";
  if (/(school|campus|pickup)/.test(text)) return "school_area_concern";
  if (/(storm|wind|gust|surf|snow|ice|heat|weather|advisory|warning|watch|severe thunderstorm)/.test(text)) return "weather_damage";
  return "other";
}

function centroidFromPositions(positions: number[][]) {
  const valid = positions.filter((position) => Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1]));
  if (!valid.length) return { latitude: null, longitude: null };

  const total = valid.reduce(
    (sum, position) => {
      sum.longitude += position[0]!;
      sum.latitude += position[1]!;
      return sum;
    },
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / valid.length,
    longitude: total.longitude / valid.length,
  };
}

export function centroidFromGeometry(geometry: unknown) {
  if (!geometry || typeof geometry !== "object") {
    return { latitude: null, longitude: null };
  }

  const candidate = geometry as { type?: string; coordinates?: unknown };
  if (candidate.type === "Point" && Array.isArray(candidate.coordinates) && Number.isFinite(candidate.coordinates[0]) && Number.isFinite(candidate.coordinates[1])) {
    return {
      longitude: candidate.coordinates[0] as number,
      latitude: candidate.coordinates[1] as number,
    };
  }

  if (candidate.type === "Polygon" && Array.isArray(candidate.coordinates)) {
    return centroidFromPositions((candidate.coordinates[0] as number[][]) || []);
  }

  if (candidate.type === "MultiPolygon" && Array.isArray(candidate.coordinates)) {
    return centroidFromPositions((((candidate.coordinates[0] as number[][][]) || [])[0] as number[][]) || []);
  }

  return { latitude: null, longitude: null };
}
