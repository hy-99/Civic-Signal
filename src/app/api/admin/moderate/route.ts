import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { moderateItem } from "@/services/moderation";

export async function POST(request: Request) {
  try {
    const viewer = await requireRole(["moderator", "admin"]);
    const input = (await request.json()) as {
      target_type: "report" | "cluster" | "signal";
      target_id: string;
      action: string;
      reason?: string | null;
    };
    const action = await moderateItem({
      actor: {
        id: viewer.id,
        role: viewer.role,
        display_name: viewer.display_name,
        username: viewer.username,
        trust_score: 50,
        home_city: viewer.home_city,
        avatar_url: null,
        created_at: "",
        updated_at: "",
      },
      ...input,
    });
    return ok(action);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to moderate item.", 400);
  }
}
