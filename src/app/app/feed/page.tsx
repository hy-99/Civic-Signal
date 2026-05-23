import { PageHeader } from "@/components/shared/states";
import { RiskClusterCard } from "@/components/risks/risk-cluster-card";
import { getRiskClusters } from "@/services/clusters";

export default async function FeedPage() {
  const clusters = await getRiskClusters({ sort: "urgent" });
  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <PageHeader eyebrow="Risk Feed" title="Active civic risks" description="Browse the prioritized non-map feed of active clusters, sorted by urgency and confidence." />
      <div className="grid gap-4">
        {clusters.map((cluster) => (
          <RiskClusterCard key={cluster.id} cluster={cluster} />
        ))}
      </div>
    </div>
  );
}
