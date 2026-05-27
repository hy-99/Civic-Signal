import { fail, ok } from "@/lib/http";
import { publishCasePublicAlert } from "@/services/cases";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = (await request.json()) as { summary?: string; approve?: boolean };
    const incident = await publishCasePublicAlert(
      id,
      input.approve === false ? "pending_approval" : "active",
      input.summary || "Mock UiPath public-alert approval task completed.",
      "uipath",
    );
    return ok({ ...incident, uipath_mode: "mock" });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "UiPath public alert task failed.", 400);
  }
}
