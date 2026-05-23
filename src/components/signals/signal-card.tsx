import Link from "next/link";

import type { PublicSignalView } from "@/lib/types";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export function SignalCard({ signal }: { signal: PublicSignalView }) {
  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{signal.source_name}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{signal.title}</h3>
        </div>
        <StatusBadge status={signal.status} />
      </div>
      <p className="text-sm leading-7 text-slate-600">{signal.text || signal.analysis_summary}</p>
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level={signal.risk_level} />
        <ConfidenceBadge confidence_label={signal.confidence_label} />
      </div>
      <div className="grid gap-2 text-sm text-slate-500">
        <div>Published: {formatDateTime(signal.published_at)}</div>
        <div>Location: {signal.address_text || "Broad area signal"}</div>
        <div>Matched cluster: {signal.cluster?.title || "Unmatched"}</div>
      </div>
      {signal.source_url ? (
        <Link href={signal.source_url} className="text-sm font-semibold text-blue-700">
          View source link
        </Link>
      ) : null}
    </Card>
  );
}
