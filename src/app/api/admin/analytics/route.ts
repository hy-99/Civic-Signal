import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { getSystemAnalytics } from "@/services/analytics";

export async function GET() {
  try {
    await requireRole(["moderator", "admin"]);
    const analytics = await getSystemAnalytics();
    return ok(analytics);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load admin analytics.", 403);
  }
}
