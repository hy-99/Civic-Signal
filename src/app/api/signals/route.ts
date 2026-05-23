import { fail, ok } from "@/lib/http";
import { manualSignalSchema } from "@/lib/validation";
import { createPublicSignal, getPublicSignals } from "@/services/signals";

export async function GET() {
  const signals = await getPublicSignals({ sort: "recent" });
  return ok(signals);
}

export async function POST(request: Request) {
  try {
    const input = manualSignalSchema.parse(await request.json());
    const signal = await createPublicSignal(input as Parameters<typeof createPublicSignal>[0]);
    return ok(signal);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create signal.", 400);
  }
}
