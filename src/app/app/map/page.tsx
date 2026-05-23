import { CommandCenter } from "@/components/map/command-center";
import { getCurrentViewer } from "@/services/auth";
import { getRiskClusters } from "@/services/clusters";
import { getReports } from "@/services/reports";

export default async function MapPage() {
  const viewer = await getCurrentViewer();
  const [clusters, reports] = await Promise.all([
    getRiskClusters({ sort: "urgent" }),
    getReports({ sort: "urgent", viewer }),
  ]);

  return <CommandCenter clusters={clusters} reports={reports} />;
}
