import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import { reportCreateSchema } from "@/lib/validation";
import { getCurrentViewer } from "@/services/auth";
import { ImageClaimMismatchError, createReport, getReports } from "@/services/reports";

export async function GET() {
  const viewer = await getCurrentViewer();
  const reports = await getReports({ viewer });
  return ok(reports);
}

export async function POST(request: Request) {
  try {
    const viewer = await getCurrentViewer();
    const input = reportCreateSchema.parse(await request.json());
    const report = await createReport(input as Parameters<typeof createReport>[0], viewer);
    return ok(report);
  } catch (error) {
    if (error instanceof ImageClaimMismatchError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.mismatch_kind === "no_hazard" ? "not_a_hazard" : "image_title_mismatch",
          mismatch_kind: error.mismatch_kind,
          details_observed: error.details_observed,
          danger_reasoning: error.danger_reasoning,
          explanation: error.explanation,
          suggested_title: error.suggested_title,
          suggested_category: error.suggested_category,
        },
        { status: 422 },
      );
    }
    return fail(error instanceof Error ? error.message : "Report submit failed.", 400);
  }
}
