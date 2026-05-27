import { CommandCenter } from "@/components/map/command-center";
import { getCurrentViewer } from "@/services/auth";
import { getRiskClusterMapStats, getRiskClusters } from "@/services/clusters";
import { getAllCaseEvents, getIncidentCases } from "@/services/cases";
import { getReports } from "@/services/reports";
import { getDangerZones } from "@/services/zones";

export default async function MapPage() {
  const viewer = await getCurrentViewer();
  const [clusters, reports, clusterStats, cases, zones, caseEvents] = await Promise.all([
    getRiskClusters({ sort: "urgent" }),
    getReports({ sort: "urgent", viewer, live_map: true }),
    getRiskClusterMapStats(),
    getIncidentCases({ include_private: true }),
    getDangerZones({ include_private: true }),
    getAllCaseEvents(),
  ]);

  return <CommandCenter clusters={clusters} reports={reports} cases={cases} zones={zones} caseEvents={caseEvents} viewer={viewer} clusterStats={clusterStats} />;
}
