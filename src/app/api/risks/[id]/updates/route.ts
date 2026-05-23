import { z } from "zod";

import { fail, ok } from "@/lib/http";
import { requireViewer } from "@/services/auth";
import { addClusterUpdate } from "@/services/clusters";

const clusterUpdateSchema = z.object({
  text: z.string().trim().min(3).max(1000),
  update_type: z.enum(["comment", "admin_note", "resolved"]).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireViewer();
    const { id } = await params;
    const input = clusterUpdateSchema.parse(await request.json());
    const update = await addClusterUpdate({
      cluster_id: id,
      user_id: viewer.id,
      text: input.text,
      update_type: input.update_type,
    });
    return ok(update);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to save cluster update.", 400);
  }
}
