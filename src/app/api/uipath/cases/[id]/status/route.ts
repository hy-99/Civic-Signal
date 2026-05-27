import { fail, ok } from "@/lib/http";
import type { IncidentCaseStatus } from "@/lib/types";
import { updateIncidentCaseStatus } from "@/services/cases";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as { status?: IncidentCaseStatus; summary?: string };
    if (!input.status) return fail("Missing status.", 400);
    const incident = await updateIncidentCaseStatus(id, input.status, "uipath", input.summary || "Mock UiPath status task completed.");
    return ok({ ...incident, uipath_mode: "mock" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "UiPath status update failed.", 400);
  }
}
