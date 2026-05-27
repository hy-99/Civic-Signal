import { fail, ok } from "@/lib/http";
import type { IncidentCaseStatus } from "@/lib/types";
import { getIncidentCaseById, updateIncidentCaseStatus } from "@/services/cases";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = await getIncidentCaseById(id);
  return incident ? ok(incident) : fail("Case not found.", 404);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as { status?: IncidentCaseStatus };
    if (!input.status) return fail("Missing status.", 400);
    return ok(await updateIncidentCaseStatus(id, input.status, "system"));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update case.", 400);
  }
}
