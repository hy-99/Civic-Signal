import { fail, ok } from "@/lib/http";
import { addCaseEvent } from "@/services/cases";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { case_id?: string; event?: string; summary?: string; metadata?: Record<string, unknown> };
    if (!input.case_id) return fail("Missing case_id.", 400);
    const event = await addCaseEvent({
      case_id: input.case_id,
      actor_type: "uipath",
      action: "uipath_sync_event",
      summary: input.summary || `Mock UiPath webhook received${input.event ? `: ${input.event}` : ""}.`,
      metadata: input.metadata || { event: input.event || "webhook" },
    });
    return ok({ event, uipath_mode: "mock" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "UiPath webhook failed.", 400);
  }
}
