import { ok } from "@/lib/http";
import { getRiskClusters } from "@/services/clusters";

export async function GET() {
  const clusters = await getRiskClusters({ sort: "urgent" });
  return ok(clusters);
}
