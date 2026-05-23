import Link from "next/link";

import { ReportCard } from "@/components/reports/report-card";
import { EmptyState, PageHeader, StatCard } from "@/components/shared/states";
import { Button } from "@/components/ui/primitives";
import { getCurrentViewer } from "@/services/auth";
import { getUserAnalytics } from "@/services/analytics";
import { getUserReports } from "@/services/reports";

export default async function MyReportsPage() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return (
      <EmptyState
        title="Login required"
        body="Sign in to see your submitted reports, follow updates, and mark issues resolved."
        action={
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        }
      />
    );
  }

  const [reports, stats] = await Promise.all([getUserReports(viewer.id), getUserAnalytics(viewer.id)]);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="My Reports" title="Your submitted reports" description="Track status, confidence, and updates across the issues you reported." />
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Total Reports" value={stats.total_reports} />
        <StatCard label="Active" value={stats.active_reports} />
        <StatCard label="Resolved" value={stats.resolved_reports} />
        <StatCard label="Verified" value={stats.verified_reports} />
        <StatCard label="Under Review" value={stats.under_review_reports} />
      </div>
      <div className="grid gap-4">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}
