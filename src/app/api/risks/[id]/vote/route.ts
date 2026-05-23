import { fail, ok } from "@/lib/http";
import { clusterVoteSchema } from "@/lib/validation";
import { requireViewer } from "@/services/auth";
import { voteOnCluster } from "@/services/clusters";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const { id } = await params;
    const input = clusterVoteSchema.parse(await request.json());
    const cluster = await voteOnCluster(id, viewer.id, input.vote_type, input.comment);
    return ok(cluster);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save cluster vote.", 400);
  }
}
