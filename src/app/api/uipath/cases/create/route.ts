import { fail, ok } from "@/lib/http";
import { addCaseEvent, createIncidentCaseFromCluster, createIncidentCaseFromReport } from "@/services/cases";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { report_id?: string; cluster_id?: string };
    const incident = input.report_id
      ? await createIncidentCaseFromReport(input.report_id)
      : input.cluster_id
        ? await createIncidentCaseFromCluster(input.cluster_id)
        : null;
    if (!incident) return fail("Provide report_id or cluster_id.", 400);
    await addCaseEvent({
      case_id: incident.id,
      actor_type: "uipath",
      action: "uipath_sync_event",
      summary: "Mock UiPath Maestro case creation task completed.",
      metadata: { mode: "mock", endpoint: "/api/uipath/cases/create" },
    });
    return ok({ ...incident, uipath_mode: "mock" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "UiPath case creation failed.", 400);
  }
}
