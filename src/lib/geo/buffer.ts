import type { GeoJsonGeometry, GeoJsonPosition } from "@/lib/types";

function metersToLatitudeDegrees(meters: number) {
  return meters / 111_320;
}

function metersToLongitudeDegrees(meters: number, latitude: number) {
  const scale = Math.cos((latitude * Math.PI) / 180);
  return meters / Math.max(111_320 * Math.abs(scale), 1e-6);
}

function averageRingPoint(ring: GeoJsonPosition[]) {
  const points = ring.length > 1 ? ring.slice(0, -1) : ring;
  const total = points.reduce(
    (acc, [longitude, latitude]) => {
      acc.longitude += longitude;
      acc.latitude += latitude;
      return acc;
    },
    { longitude: 0, latitude: 0 },
  );

  return {
    longitude: total.longitude / Math.max(points.length, 1),
    latitude: total.latitude / Math.max(points.length, 1),
  };
}

function closeRing(ring: GeoJsonPosition[]) {
  if (ring.length === 0) return ring;
  const [firstLongitude, firstLatitude] = ring[0];
  const [lastLongitude, lastLatitude] = ring[ring.length - 1];
  if (firstLongitude === lastLongitude && firstLatitude === lastLatitude) return ring;
  return [...ring, [firstLongitude, firstLatitude]];
}

function bufferRing(ring: GeoJsonPosition[], meters: number) {
  if (meters <= 0) return closeRing(ring);
  const center = averageRingPoint(ring);

  return closeRing(
    ring.slice(0, -1).map(([longitude, latitude]) => {
      const dxMeters = (longitude - center.longitude) * 111_320 * Math.cos((center.latitude * Math.PI) / 180);
      const dyMeters = (latitude - center.latitude) * 111_320;
      const distanceMeters = Math.hypot(dxMeters, dyMeters);
      const scale = distanceMeters <= 1 ? 1 : (distanceMeters + meters) / distanceMeters;

      const nextLatitude = center.latitude + (latitude - center.latitude) * scale;
      const nextLongitude = center.longitude + (longitude - center.longitude) * scale;
      if (distanceMeters <= 1) {
        return [nextLongitude + metersToLongitudeDegrees(meters, center.latitude), nextLatitude] satisfies GeoJsonPosition;
      }
      return [nextLongitude, nextLatitude] satisfies GeoJsonPosition;
    }),
  );
}

export function circlePolygon(latitude: number, longitude: number, meters: number, sides = 12): GeoJsonGeometry {
  const latDegrees = metersToLatitudeDegrees(meters);
  const ring: GeoJsonPosition[] = [];

  for (let index = 0; index < sides; index += 1) {
    const theta = (Math.PI * 2 * index) / sides;
    const y = latitude + latDegrees * Math.sin(theta);
    const x = longitude + metersToLongitudeDegrees(meters * Math.cos(theta), latitude);
    ring.push([x, y]);
  }

  return {
    type: "Polygon",
    coordinates: [closeRing(ring)],
  };
}

export function bufferPolygonMeters(geometry: GeoJsonGeometry, meters: number): GeoJsonGeometry {
  if (meters <= 0) return geometry;

  if (geometry.type === "Point") {
    return circlePolygon(geometry.coordinates[1], geometry.coordinates[0], meters);
  }

  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) => bufferRing(ring, meters)),
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => bufferRing(ring, meters))),
    };
  }

  return geometry;
}
