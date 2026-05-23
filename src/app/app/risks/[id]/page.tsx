import { notFound } from "next/navigation";

import { ModerationPanel } from "@/components/admin/moderation-panel";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { ScoreBreakdown } from "@/components/shared/score-breakdown";
import { ActionPlanCard, EvidenceCard, PageHeader } from "@/components/shared/states";
import { VerificationButtons } from "@/components/shared/verification-buttons";
import { getRiskClusterById } from "@/services/clusters";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cluster = await getRiskClusterById(id);
  if (!cluster) notFound();

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Risk Cluster" title={cluster.title} description={cluster.summary || "Cluster summary pending."} />
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level={cluster.risk_level} />
        <ConfidenceBadge confidence_label={cluster.confidence_label} />
        <StatusBadge status={cluster.status} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <EvidenceCard title="Citizen Reports" body={String(cluster.report_count)} />
        <EvidenceCard title="Public Signals" body={String(cluster.signal_count)} />
        <EvidenceCard title="Confirmations" body={String(cluster.vote_summary.confirm)} />
        <EvidenceCard title="Photos" body={String(cluster.photo_count)} />
      </div>
      <ScoreBreakdown score={cluster.score_breakdown} />
      <ActionPlanCard text={cluster.action_plan} />
      <VerificationButtons entity="cluster" entity_id={cluster.id} />
      <div className="grid gap-4 lg:grid-cols-2">
        <EvidenceCard title="Citizen Reports" body={cluster.reports.map((item) => item.title).join(", ") || "No linked reports."} />
        <EvidenceCard title="Public Signals" body={cluster.signals.map((item) => item.title).join(", ") || "No linked signals."} />
      </div>
      <ModerationPanel target_type="cluster" target_id={cluster.id} />
    </div>
  );
}
