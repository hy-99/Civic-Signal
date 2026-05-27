import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { approveDangerZone } from "@/services/zones";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireRole(["moderator", "admin"]);
    const { id } = await params;
    return ok(await approveDangerZone(id, viewer.id || null));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to approve danger zone.", 400);
  }
}
