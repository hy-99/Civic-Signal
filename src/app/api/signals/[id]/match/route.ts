import { fail, ok } from "@/lib/http";
import { matchSignalToCluster } from "@/services/signals";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const signal = await matchSignalToCluster(id);
    return ok(signal);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to match signal.", 400);
  }
}
