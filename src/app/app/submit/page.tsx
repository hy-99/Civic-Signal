import Link from "next/link";
import { X } from "lucide-react";

import { ReportForm } from "@/components/forms/report-form";
import { CommandCenter } from "@/components/map/command-center";
import { getCurrentViewer } from "@/services/auth";
import { getRiskClusters } from "@/services/clusters";
import { getReports } from "@/services/reports";

export default async function SubmitPage() {
  const viewer = await getCurrentViewer();
  const [clusters, reports] = await Promise.all([
    getRiskClusters({ sort: "urgent" }),
    getReports({ sort: "urgent", viewer }),
  ]);

  return (
    <CommandCenter clusters={clusters} reports={reports} submitMode>
      <section className="max-h-[calc(100vh-88px)] w-full max-w-[650px] overflow-hidden rounded-2xl bg-white shadow-[0_36px_90px_rgba(15,23,42,0.35)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Incident entry panel</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">Log a local hazard</h1>
            <p className="mt-1 text-sm text-slate-500">Reports may appear publicly, but your email will not be shown.</p>
          </div>
          <Link href="/app/map" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Close submit report modal">
            <X className="h-5 w-5" />
          </Link>
        </div>
        <div className="civic-scrollbar max-h-[calc(100vh-210px)] overflow-y-auto px-5 py-5">
          <ReportForm />
        </div>
      </section>
    </CommandCenter>
  );
}
