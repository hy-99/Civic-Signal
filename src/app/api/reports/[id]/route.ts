import { fail, ok } from "@/lib/http";
import { reportPatchSchema } from "@/lib/validation";
import { getCurrentViewer } from "@/services/auth";
import { getReportById, patchReport } from "@/services/reports";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentViewer();
  const report = await getReportById(id, viewer);
  if (!report) return fail("Report not found.", 404);
  return ok(report);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = reportPatchSchema.parse(await request.json());
    const report = await patchReport(id, input as Parameters<typeof patchReport>[1]);
    return ok(report);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update report.", 400);
  }
}
