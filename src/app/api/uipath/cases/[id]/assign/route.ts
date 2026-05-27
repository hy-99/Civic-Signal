import { fail, ok } from "@/lib/http";
import type { CaseOwnerRole } from "@/lib/types";
import { addCaseEvent, assignIncidentCase } from "@/services/cases";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as { owner_role?: CaseOwnerRole; owner_department?: CaseOwnerRole | null };
    const incident = await assignIncidentCase(id, input.owner_role || "responder", input.owner_department || null);
    await addCaseEvent({
      case_id: incident.id,
      actor_type: "uipath",
      action: "uipath_sync_event",
      summary: "Mock UiPath assignment task completed.",
      metadata: { owner_role: incident.owner_role, owner_department: incident.owner_department },
    });
    return ok({ ...incident, uipath_mode: "mock" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "UiPath assignment failed.", 400);
  }
}
