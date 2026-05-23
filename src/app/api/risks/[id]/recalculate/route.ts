import { fail, ok } from "@/lib/http";
import { recalculateCluster } from "@/services/clusters";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cluster = await recalculateCluster(id);
    return ok(cluster);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to recalculate cluster.", 400);
  }
}
