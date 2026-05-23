import { fail, ok } from "@/lib/http";
import { ignoreSignal } from "@/services/signals";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const signal = await ignoreSignal(id);
    return ok(signal);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to ignore signal.", 400);
  }
}
