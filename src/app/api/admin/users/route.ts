import { fail, ok } from "@/lib/http";
import { requireRole } from "@/services/auth";
import { loadState } from "@/lib/data-store";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const state = await loadState();
    return ok(state.profiles);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load users.", 403);
  }
}
