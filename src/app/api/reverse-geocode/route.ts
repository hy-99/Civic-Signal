import { fail, ok } from "@/lib/http";
import { reverseGeocode } from "@/services/geocoding";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail("Valid coordinates are required.", 400);
    const result = await reverseGeocode(lat, lng);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Reverse geocoding failed.", 400);
  }
}
