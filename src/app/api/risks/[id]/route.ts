import { fail, ok } from "@/lib/http";
import { getRiskClusterById, updateClusterStatus } from "@/services/clusters";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cluster = await getRiskClusterById(id);
  if (!cluster) return fail("Risk cluster not found.", 404);
  return ok(cluster);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = (await request.json()) as { status: string };
    const cluster = await updateClusterStatus(id, status as never);
    return ok(cluster);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to update cluster.", 400);
  }
}
