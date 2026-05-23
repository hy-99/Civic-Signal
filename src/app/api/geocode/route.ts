import { fail, ok } from "@/lib/http";
import { geocodeAddress } from "@/services/geocoding";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query");
    if (!query) return fail("Query is required.", 400);
    const result = await geocodeAddress(query);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Geocoding failed.", 400);
  }
}
