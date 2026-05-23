import { fail, ok } from "@/lib/http";
import { sourceFeedSchema } from "@/lib/validation";
import { requireRole } from "@/services/auth";
import { updateSourceFeed } from "@/services/source-feeds";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const input = sourceFeedSchema.partial().parse(await request.json());
    const feed = await updateSourceFeed(id, input);
    return ok(feed);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update source feed.", 400);
  }
}
