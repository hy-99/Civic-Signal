import { fail, ok } from "@/lib/http";
import { reportCreateSchema } from "@/lib/validation";
import { getCurrentViewer } from "@/services/auth";
import { createReport, getReports } from "@/services/reports";

export async function GET() {
  const viewer = await getCurrentViewer();
  const reports = await getReports({ viewer });
  return ok(reports);
}

export async function POST(request: Request) {
  try {
    const viewer = await getCurrentViewer();
    const input = reportCreateSchema.parse(await request.json());
    const report = await createReport(input as Parameters<typeof createReport>[0], viewer);
    return ok(report);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Report submit failed.", 400);
  }
}
