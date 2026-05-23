import Link from "next/link";

import type { RiskClusterView } from "@/lib/types";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { formatRelativeTime } from "@/lib/utils";

export function RiskClusterCard({ cluster }: { cluster: RiskClusterView }) {
  return (
    <div className="civic-light-card grid gap-4 rounded-[1.8rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">{cluster.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{cluster.report_count} reports, {cluster.signal_count} signals</p>
        </div>
        <StatusBadge status={cluster.status} />
      </div>
      <p className="text-sm leading-7 text-slate-600">{cluster.summary}</p>
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level={cluster.risk_level} />
        <ConfidenceBadge confidence_label={cluster.confidence_label} />
      </div>
      <div className="grid gap-2 text-sm text-slate-500 md:grid-cols-2">
        <div>Confirmations: {cluster.vote_summary.confirm}</div>
        <div>Disputes: {cluster.vote_summary.dispute}</div>
        <div>Evidence: {cluster.evidence_count}</div>
        <div>Last activity: {formatRelativeTime(cluster.last_activity_at)}</div>
      </div>
      <Link href={`/app/risks/${cluster.id}`} className="text-sm font-semibold text-[#2653da]">
        Open cluster details
      </Link>
    </div>
  );
}
