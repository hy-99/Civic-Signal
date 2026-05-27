import { fail, ok } from "@/lib/http";
import { createIncidentCaseFromCluster, createIncidentCaseFromReport, getIncidentCases } from "@/services/cases";

export async function GET() {
  const cases = await getIncidentCases({ include_private: true });
  return ok(cases);
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { report_id?: string; cluster_id?: string };
    if (input.report_id) return ok(await createIncidentCaseFromReport(input.report_id));
    if (input.cluster_id) return ok(await createIncidentCaseFromCluster(input.cluster_id));
    return fail("Provide report_id or cluster_id.", 400);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create case.", 400);
  }
}
