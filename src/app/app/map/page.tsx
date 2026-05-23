import { CommandCenter } from "@/components/map/command-center";
import { getCurrentViewer } from "@/services/auth";
import { getRiskClusterMapStats, getRiskClusters } from "@/services/clusters";
import { getReports } from "@/services/reports";

export default async function MapPage() {
  const viewer = await getCurrentViewer();
  const [clusters, reports, clusterStats] = await Promise.all([
    getRiskClusters({ sort: "urgent" }),
    getReports({ sort: "urgent", viewer, live_map: true }),
    getRiskClusterMapStats(),
  ]);

  return <CommandCenter clusters={clusters} reports={reports} viewer={viewer} clusterStats={clusterStats} />;
}
