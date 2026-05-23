import { fail, ok } from "@/lib/http";
import { sourceFeedSchema } from "@/lib/validation";
import { requireRole } from "@/services/auth";
import { createSourceFeed, getSourceFeeds } from "@/services/source-feeds";

export async function GET() {
  await requireRole(["admin"]);
  const feeds = await getSourceFeeds();
  return ok(feeds);
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const input = sourceFeedSchema.parse(await request.json());
    const feed = await createSourceFeed(input as Parameters<typeof createSourceFeed>[0]);
    return ok(feed);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create source feed.", 400);
  }
}
