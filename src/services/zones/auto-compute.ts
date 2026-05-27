import type { GeoJsonGeometry, GeoJsonPosition } from "@/lib/types";
import { bufferPolygonMeters, circlePolygon } from "@/lib/geo/buffer";

export type ClusterPoint = {
  latitude: number;
  longitude: number;
};

function averagePoint(points: ClusterPoint[]) {
  const total = points.reduce(
    (acc, point) => {
      acc.latitude += point.latitude;
      acc.longitude += point.longitude;
      return acc;
    },
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: total.latitude / Math.max(points.length, 1),
    longitude: total.longitude / Math.max(points.length, 1),
  };
}

function uniquePoints(points: ClusterPoint[]) {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cross(o: GeoJsonPosition, a: GeoJsonPosition, b: GeoJsonPosition) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function closeRing(ring: GeoJsonPosition[]) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function convexHull(points: ClusterPoint[]) {
  const sorted = uniquePoints(points)
    .map((point) => [point.longitude, point.latitude] satisfies GeoJsonPosition)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  if (sorted.length < 3) return null;

  const lower: GeoJsonPosition[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: GeoJsonPosition[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  if (hull.length < 3) return null;
  return closeRing(hull);
}

export function computeAutoZoneGeometry(points: ClusterPoint[], options?: { buffer_meters?: number; fallback_radius_meters?: number }): GeoJsonGeometry {
  const fallbackRadius = options?.fallback_radius_meters ?? 200;
  const bufferMeters = options?.buffer_meters ?? fallbackRadius;
  const validPoints = uniquePoints(
    points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
  );

  if (validPoints.length === 0) {
    return circlePolygon(0, 0, fallbackRadius);
  }

  if (validPoints.length < 3) {
    const center = averagePoint(validPoints);
    return circlePolygon(center.latitude, center.longitude, fallbackRadius);
  }

  const ring = convexHull(validPoints);
  if (!ring) {
    const center = averagePoint(validPoints);
    return circlePolygon(center.latitude, center.longitude, fallbackRadius);
  }

  return bufferPolygonMeters(
    {
      type: "Polygon",
      coordinates: [ring],
    },
    bufferMeters,
  );
}
