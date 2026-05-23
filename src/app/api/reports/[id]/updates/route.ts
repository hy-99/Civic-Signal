import { fail, ok } from "@/lib/http";
import { reportUpdateSchema } from "@/lib/validation";
import { requireViewer } from "@/services/auth";
import { addReportUpdate } from "@/services/reports";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const { id } = await params;
    const input = reportUpdateSchema.parse(await request.json());
    const update = await addReportUpdate({
      report_id: id,
      user_id: viewer.id,
      text: input.text,
      update_type: input.update_type,
    });
    return ok(update);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to add update.", 400);
  }
}
