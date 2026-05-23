import { PriorityBoard } from "@/components/board/priority-board";
import { getCurrentViewer } from "@/services/auth";
import { getReports } from "@/services/reports";

export default async function PriorityBoardPage() {
  const viewer = await getCurrentViewer();
  const reports = await getReports({ sort: "urgent", viewer });

  return <PriorityBoard reports={reports} />;
}
