import { fail, ok } from "@/lib/http";
import { reportVoteSchema } from "@/lib/validation";
import { requireViewer } from "@/services/auth";
import { voteOnReport } from "@/services/reports";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const { id } = await params;
    const input = reportVoteSchema.parse(await request.json());
    const report = await voteOnReport(id, viewer.id, input.vote_type, input.comment);
    return ok(report);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save vote.", 400);
  }
}
