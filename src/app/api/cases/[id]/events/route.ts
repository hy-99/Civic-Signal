import { fail, ok } from "@/lib/http";
import type { CaseEventAction, CaseEventActorType } from "@/lib/types";
import { addCaseEvent, getCaseEvents } from "@/services/cases";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ok(await getCaseEvents(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as {
      actor_type?: CaseEventActorType;
      actor_label?: string | null;
      action?: CaseEventAction;
      summary?: string;
      metadata?: Record<string, unknown>;
    };
    if (!input.summary) return fail("Missing event summary.", 400);
    const event = await addCaseEvent({
      case_id: id,
      actor_type: input.actor_type || "system",
      actor_label: input.actor_label || null,
      action: input.action || "uipath_sync_event",
      summary: input.summary,
      metadata: input.metadata || {},
    });
    return ok(event);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to add case event.", 400);
  }
}
