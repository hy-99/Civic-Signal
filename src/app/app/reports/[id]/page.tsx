import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { EvidenceTimeline } from "@/components/shared/evidence-timeline";
import { ScoreBreakdown } from "@/components/shared/score-breakdown";
import { ActionPlanCard, EvidenceCard, PageHeader } from "@/components/shared/states";
import { VerificationButtons } from "@/components/shared/verification-buttons";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { ModerationPanel } from "@/components/admin/moderation-panel";
import { loadState } from "@/lib/data-store";
import { getCurrentViewer } from "@/services/auth";
import { getReportById } from "@/services/reports";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentViewer();
  const report = await getReportById(id, viewer);
  if (!report) notFound();

  const state = await loadState();
  const updates = state.report_updates
    .filter((update) => update.report_id === report.id || (report.cluster?.id && update.cluster_id === report.cluster.id))
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const relatedReports = state.reports.filter((candidate) => candidate.cluster_id === report.cluster?.id && candidate.id !== report.id);
  const relatedSignals = state.public_signals.filter((signal) => signal.cluster_id === report.cluster?.id);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <Link
        href="/app/map"
        className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to map
      </Link>
      <PageHeader eyebrow="Report Detail" title={report.title} description={report.address_text || "Location pending verification"} />
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level={report.risk_level} />
        <ConfidenceBadge confidence_label={report.confidence_label} />
        <StatusBadge status={report.status} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <EvidenceCard title="Evidence" body={report.description} meta={`Submitted by ${report.display_name}`} />
        <ActionPlanCard text={report.analysis_json.score_breakdown.recommended_action} />
      </div>
      <ScoreBreakdown score={report.analysis_json.score_breakdown} imageAnalysis={report.analysis_json.image_analysis} />
      <VerificationButtons entity="report" entity_id={report.id} />
      {report.cluster ? (
        <EvidenceCard
          title="Related Cluster"
          body={`Part of risk cluster: ${report.cluster.title}`}
          meta={`Reports: ${report.cluster.report_count} • Signals: ${report.cluster.signal_count}`}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <EvidenceCard title="Related Reports" body={relatedReports.map((item) => item.title).join(", ") || "No nearby related reports yet."} />
        <EvidenceCard title="Related Public Signals" body={relatedSignals.map((item) => item.title).join(", ") || "No public signals matched yet."} />
      </div>
      <EvidenceTimeline updates={updates} />
      {report.cluster ? (
        <Link href={`/app/risks/${report.cluster.id}`} className="text-sm font-semibold text-blue-700">
          View cluster details
        </Link>
      ) : null}
      {viewer && ["moderator", "admin"].includes(viewer.role) ? <ModerationPanel /> : null}
    </div>
  );
}
