import Link from "next/link";

import type { RiskClusterView } from "@/lib/types";
import { hasMapConfig } from "@/lib/env";
import { CategoryIcon, ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { formatRelativeTime } from "@/lib/utils";

const pinPositions = [
  "left-[18%] top-[22%]",
  "left-[53%] top-[28%]",
  "left-[40%] top-[48%]",
  "left-[70%] top-[56%]",
  "left-[24%] top-[66%]",
  "left-[61%] top-[74%]",
];

function pinTone(risk: RiskClusterView["risk_level"]) {
  if (risk === "urgent") return "bg-red-500 text-white";
  if (risk === "serious") return "bg-orange-500 text-white";
  if (risk === "watch") return "bg-amber-400 text-slate-950";
  return "bg-emerald-500 text-white";
}

export function MapPin({ cluster, index }: { cluster: RiskClusterView; index: number }) {
  return (
    <div className={`absolute ${pinPositions[index % pinPositions.length]}`}>
      <div className={`flex min-w-[88px] items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-lg ${pinTone(cluster.risk_level)} ${cluster.risk_level === "urgent" ? "pulse-urgent" : ""}`}>
        <CategoryIcon category={cluster.category} className="h-4 w-4" />
        <span>{cluster.report_count + cluster.signal_count}</span>
      </div>
    </div>
  );
}

export function MapShell({
  clusters,
  selected,
}: {
  clusters: RiskClusterView[];
  selected: RiskClusterView | null;
}) {
  const configured = hasMapConfig();

  return (
    <div className="grid gap-4 xl:grid-cols-[1.22fr_0.78fr]">
      <div className="civic-light-card overflow-hidden rounded-[2rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Live civic map</p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">Regional risk view</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Risk Clusters</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Citizen Reports</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Public Signals</span>
          </div>
        </div>
        <div className="civic-map-surface civic-map-grid relative min-h-[560px] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.7),transparent_18%),radial-gradient(circle_at_76%_24%,rgba(255,255,255,0.6),transparent_16%)]" />
          <div className="absolute left-[7%] top-[17%] h-[2px] w-[26%] rotate-12 rounded-full bg-slate-900/80" />
          <div className="absolute left-[34%] top-[21%] h-[2px] w-[31%] -rotate-6 rounded-full bg-slate-900/75" />
          <div className="absolute left-[25%] top-[38%] h-[2px] w-[44%] rotate-[18deg] rounded-full bg-slate-900/75" />
          <div className="absolute left-[16%] top-[54%] h-[2px] w-[55%] -rotate-[10deg] rounded-full bg-slate-900/75" />
          <div className="absolute left-[45%] top-[66%] h-[2px] w-[26%] rotate-[28deg] rounded-full bg-slate-900/75" />
          <div className="absolute left-[8%] top-[8%] rounded-2xl bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
            {configured ? "MapLibre style detected. Ready for live rendering." : "Map style not configured. Showing resilient map placeholder."}
          </div>
          <div className="absolute bottom-5 left-5 rounded-2xl bg-white/82 px-4 py-3 text-sm text-slate-700 shadow-sm">
            <p className="font-semibold text-slate-950">Live hazard region</p>
            <p className="mt-1 text-slate-500">Map pins reflect citizen reports, hazard clusters, and nearby corroborating signals.</p>
          </div>
          {clusters.slice(0, 6).map((cluster, index) => (
            <MapPin key={cluster.id} cluster={cluster} index={index} />
          ))}
        </div>
      </div>

      <div className="civic-light-card grid gap-5 rounded-[2rem] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Cluster preview</p>
            <h3 className="mt-1 text-2xl font-black tracking-[-0.03em] text-slate-950">
              {selected ? selected.title : "Select a risk cluster"}
            </h3>
          </div>
          {selected ? <StatusBadge status={selected.status} /> : null}
        </div>

        {selected ? (
          <>
            <div className="flex flex-wrap gap-2">
              <RiskBadge risk_level={selected.risk_level} />
              <ConfidenceBadge confidence_label={selected.confidence_label} />
            </div>

            <p className="text-sm leading-7 text-slate-600">{selected.summary}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Citizen reports</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{selected.report_count}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public signals</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{selected.signal_count}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Evidence count</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{selected.evidence_count}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last activity</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{formatRelativeTime(selected.last_activity_at)}</p>
                <p className="mt-1 text-sm text-slate-500">Monitoring recency and community verification.</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-blue-100 bg-[#edf5ff] p-4">
              <p className="text-sm font-semibold text-slate-950">Why this is prioritized</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{selected.score_breakdown.risk_reason}</p>
            </div>

            <Link
              href={`/app/risks/${selected.id}`}
              className="inline-flex items-center justify-center rounded-2xl bg-[#2653da] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f48c4]"
            >
              View cluster details
            </Link>
          </>
        ) : (
          <p className="text-sm leading-7 text-slate-600">Choose a cluster from the feed to open its risk preview, evidence counts, and scoring explanation.</p>
        )}
      </div>
    </div>
  );
}
