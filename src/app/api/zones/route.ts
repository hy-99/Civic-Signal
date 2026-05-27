import { fail, ok } from "@/lib/http";
import type { DangerZone } from "@/lib/types";
import { createDangerZone, getDangerZones } from "@/services/zones";

export async function GET() {
  return ok(await getDangerZones({ include_private: true }));
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Omit<DangerZone, "id" | "created_at" | "updated_at">;
    return ok(await createDangerZone(input));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to create danger zone.", 400);
  }
}
