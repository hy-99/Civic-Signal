import { fail, ok } from "@/lib/http";
import { reportPatchSchema } from "@/lib/validation";
import { getCurrentViewer, requireRole } from "@/services/auth";
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
    await requireRole(["moderator", "admin"]);
    const { id } = await params;
    const input = reportPatchSchema.parse(await request.json());
    const report = await patchReport(id, input as Parameters<typeof patchReport>[1]);
    return ok(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update report.";
    const status = message === "Unauthorized." ? 403 : message === "Login required." ? 401 : 400;
    return fail(message, status);
  }
}
