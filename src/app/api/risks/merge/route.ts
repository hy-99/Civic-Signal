import { fail, ok } from "@/lib/http";
import { mergeClusters } from "@/services/clusters";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { source_id: string; target_id: string };
    const cluster = await mergeClusters(input.source_id, input.target_id);
    return ok(cluster);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to merge clusters.", 400);
  }
}
