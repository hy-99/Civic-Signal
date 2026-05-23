import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { getReviewQueue } from "@/services/moderation";

export async function GET() {
  try {
    await requireRole(["moderator", "admin"]);
    const queue = await getReviewQueue();
    return ok(queue);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load review queue.", 403);
  }
}
