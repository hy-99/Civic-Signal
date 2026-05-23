import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { withMutableState } from "@/lib/data-store";
import { nowIso } from "@/lib/utils";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const input = (await request.json()) as { role?: string; trust_score?: number };
    const profile = await withMutableState((state) => {
      const item = state.profiles.find((profile) => profile.id === id);
      if (!item) throw new Error("User not found.");
      if (typeof input.role === "string") item.role = input.role as never;
      if (typeof input.trust_score === "number") item.trust_score = input.trust_score;
      item.updated_at = nowIso();
      return item;
    });
    return ok(profile);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update user.", 400);
  }
}
