import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { testSourceFeed } from "@/services/source-feeds";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const result = await testSourceFeed(id);
    return ok(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to test source feed.", 400);
  }
}
