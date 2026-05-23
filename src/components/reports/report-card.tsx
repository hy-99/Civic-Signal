import Link from "next/link";

import type { ReportCardView } from "@/lib/types";
import { CategoryIcon, ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { formatRelativeTime } from "@/lib/utils";

export function ReportCard({ report }: { report: ReportCardView }) {
  return (
    <div className="civic-light-card grid gap-4 rounded-[1.8rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-[1.2rem] bg-[#edf5ff] p-3">
            <CategoryIcon category={report.category} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">{report.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{report.address_text || "Location pending verification"}</p>
          </div>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <p className="text-sm leading-7 text-slate-600">{report.analysis_summary || report.description}</p>
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level={report.risk_level} />
        <ConfidenceBadge confidence_label={report.confidence_label} />
      </div>
      <div className="grid gap-2 text-sm text-slate-500 md:grid-cols-2">
        <div>Reports nearby: {report.related_report_count}</div>
        <div>Signals nearby: {report.related_signal_count}</div>
        <div>Confirmations: {report.vote_summary.confirm}</div>
        <div>Updated: {formatRelativeTime(report.updated_at)}</div>
      </div>
      <Link href={`/app/reports/${report.id}`} className="text-sm font-semibold text-[#2653da]">
        Open report details
      </Link>
    </div>
  );
}
