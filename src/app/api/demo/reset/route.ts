import { fail, ok } from "@/lib/http";
import { isDemoMode } from "@/lib/env";
import { resetDemoState } from "@/lib/data-store";

export async function POST() {
  if (!isDemoMode()) {
    return fail("Demo reset is only available in demo mode.", 403);
  }

  const state = await resetDemoState();
  return ok({
    reports: state.reports.length,
    clusters: state.risk_clusters.length,
    signals: state.public_signals.length,
  });
}
