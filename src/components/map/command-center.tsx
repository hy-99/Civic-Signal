"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Building2,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";

import { CATEGORY_OPTIONS } from "@/lib/constants";
import type { ReportCardView, ReportCategoryKey, RiskClusterView, RiskLevel } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";
import { RiskBadge } from "@/components/shared/badges";
import { RealMap, type FocusLocation, type MapAudience } from "@/components/map/real-map";
import { LocationSearch, type LocationOption } from "@/components/map/location-search";
import { Button, Input, Select } from "@/components/ui/primitives";

type CommandCenterProps = {
  clusters: RiskClusterView[];
  reports: ReportCardView[];
  submitMode?: boolean;
  children?: React.ReactNode;
};

const AUDIENCE_COPY = {
  citizen: {
    sidebarEyebrow: "Citizen view",
    sidebarTitle: "Hazards near you",
    sidebarHelp: "Avoid these areas, or tap Confirm to verify what others reported.",
    stats: [
      { key: "active", label: "Active", tone: "bg-blue-50 text-blue-700" },
      { key: "urgent", label: "Avoid", tone: "bg-rose-50 text-rose-700" },
      { key: "resolved", label: "Cleared", tone: "bg-emerald-50 text-emerald-700" },
    ],
  },
  responder: {
    sidebarEyebrow: "Government / Police view",
    sidebarTitle: "Active incidents",
    sidebarHelp: "Prioritized by AI risk score. Dispatch and route from the cluster detail.",
    stats: [
      { key: "active", label: "Open", tone: "bg-blue-50 text-blue-700" },
      { key: "urgent", label: "Dispatch", tone: "bg-rose-50 text-rose-700" },
      { key: "resolved", label: "Cleared", tone: "bg-emerald-50 text-emerald-700" },
    ],
  },
} as const;

function HazardListItem({
  report,
  selected,
  audience,
  onSelect,
  onVote,
}: {
  report: ReportCardView;
  selected: boolean;
  audience: MapAudience;
  onSelect: () => void;
  onVote: (reportId: string, vote: "confirm" | "dispute" | "resolved") => void;
}) {
  const riskAccent =
    report.risk_level === "urgent"
      ? "border-l-rose-500"
      : report.risk_level === "serious"
        ? "border-l-orange-500"
        : report.risk_level === "watch"
          ? "border-l-yellow-400"
          : "border-l-slate-300";

  return (
    <article
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border border-l-4 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        riskAccent,
        selected ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-100" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-black leading-5 tracking-[-0.01em] text-slate-950">{report.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {report.analysis_summary || report.description}
          </p>
        </div>
        {audience === "responder" ? (
          <div className="grid place-items-center rounded-lg bg-slate-900 px-2 py-1 text-xs font-black text-white">
            {report.risk_score}
          </div>
        ) : (
          <RiskBadge risk_level={report.risk_level} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="truncate">{report.address_text || "Location pending"}</span>
        <span>{formatRelativeTime(report.updated_at)}</span>
        {audience === "responder" ? (
          <>
            <span>Conf {report.confidence_score}</span>
            <span>{report.vote_summary.confirm} ✓ {report.vote_summary.dispute} ✗</span>
          </>
        ) : (
          <span>{report.vote_summary.confirm} confirmed</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onVote(report.id, "confirm");
          }}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm shadow-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
        >
          {audience === "responder" ? "Verify" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onVote(report.id, "dispute");
          }}
          className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700 shadow-sm shadow-rose-100 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800"
        >
          Dispute
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onVote(report.id, "resolved");
          }}
          className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700 shadow-sm shadow-sky-100 transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800"
        >
          {audience === "responder" ? "Close" : "Resolved"}
        </button>
        <Link
          href={`/app/reports/${report.id}`}
          className="ml-auto text-[11px] font-black text-blue-700"
          onClick={(event) => event.stopPropagation()}
        >
          Details →
        </Link>
      </div>
    </article>
  );
}

function MapLegendStrip() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-md ring-1 ring-slate-200">
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> Urgent
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" /> Serious
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" /> Watch
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" /> Low
      </span>
    </div>
  );
}

function AudienceToggle({
  value,
  onChange,
}: {
  value: MapAudience;
  onChange: (next: MapAudience) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Switch audience view"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold shadow-sm"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "citizen"}
        onClick={() => onChange("citizen")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
          value === "citizen" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-blue-700",
        )}
      >
        <Users className="h-3.5 w-3.5" />
        Citizen
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "responder"}
        onClick={() => onChange("responder")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
          value === "responder" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-950",
        )}
      >
        <Building2 className="h-3.5 w-3.5" />
        Gov / Police
      </button>
    </div>
  );
}

export function CommandCenter({ clusters, reports, submitMode = false, children }: CommandCenterProps) {
  const [selectedId, setSelectedId] = useState<string | null>(clusters[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReportCategoryKey | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [audience, setAudience] = useState<MapAudience>("citizen");
  const [notice, setNotice] = useState("");
  const [focusLocation, setFocusLocation] = useState<FocusLocation | null>(null);
  const [, startTransition] = useTransition();

  const pickLocation = (option: LocationOption) => {
    setFocusLocation({
      latitude: option.latitude,
      longitude: option.longitude,
      zoom: option.zoom ?? 15,
      token: Date.now(),
    });
    setNotice(`Jumped to ${option.name}.`);
  };

  const filteredClusters = useMemo(() => {
    const queryText = query.toLowerCase();
    return clusters
      .filter((cluster) => (category === "all" ? true : cluster.category === category))
      .filter((cluster) => (risk === "all" ? true : cluster.risk_level === risk))
      .filter((cluster) => `${cluster.title} ${cluster.summary || ""}`.toLowerCase().includes(queryText))
      .sort((a, b) => b.risk_score - a.risk_score || b.confidence_score - a.confidence_score);
  }, [category, clusters, query, risk]);

  const selected = filteredClusters.find((cluster) => cluster.id === selectedId) || filteredClusters[0] || null;

  const filteredReports = useMemo(() => {
    const queryText = query.toLowerCase();
    return reports
      .filter((report) => (category === "all" ? true : report.category === category))
      .filter((report) => (risk === "all" ? true : report.risk_level === risk))
      .filter((report) => `${report.title} ${report.description} ${report.address_text || ""}`.toLowerCase().includes(queryText))
      .sort((a, b) => b.risk_score - a.risk_score || b.confidence_score - a.confidence_score);
  }, [category, query, reports, risk]);

  const activeCount = clusters.filter((cluster) => cluster.status === "active" || cluster.status === "monitoring" || cluster.status === "urgent").length;
  const urgentCount = clusters.filter((cluster) => cluster.risk_level === "urgent" || cluster.risk_level === "serious").length;
  const resolvedCount = clusters.filter((cluster) => cluster.status === "resolved").length;

  const audienceCopy = AUDIENCE_COPY[audience];
  const statValues = { active: activeCount, urgent: urgentCount, resolved: resolvedCount } as Record<string, number>;

  const voteOnReport = (reportId: string, vote: "confirm" | "dispute" | "resolved") => {
    startTransition(async () => {
      const response = await fetch(`/api/reports/${reportId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: vote }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? `Saved vote: ${vote}.` : payload.error || "Sign in to verify reports.");
    });
  };

  return (
    <div className={cn("civic-map-entrance relative h-full min-h-0 overflow-y-auto bg-[#eef3f8] lg:overflow-hidden", submitMode && "pointer-events-none select-none")}>
      <div className={cn("min-h-full p-2 lg:h-full lg:min-h-0 lg:p-3", submitMode && "scale-[0.985] blur-[3px] brightness-75")}>
        <div className="civic-command-grid min-h-full gap-2 lg:h-full lg:min-h-0">
          {/* LEFT: Hazard list sidebar */}
          <section data-command-column="reports" className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
            <div className="border-b border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-700">{audienceCopy.sidebarEyebrow}</p>
                  <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">{audienceCopy.sidebarTitle}</h2>
                </div>
                <Link href="/app/submit">
                  <Button className="h-8 rounded-lg px-3 text-xs">+ Report</Button>
                </Link>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{audienceCopy.sidebarHelp}</p>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                {audienceCopy.stats.map((stat) => (
                  <div key={stat.key} className={cn("rounded-lg px-2 py-1.5", stat.tone)}>
                    <p className="text-base font-black">{statValues[stat.key] ?? 0}</p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em]">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search hazards"
                    className="h-9 rounded-lg py-2 pl-8 text-xs shadow-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as ReportCategoryKey | "all")}
                    className="h-9 rounded-lg py-2 text-xs shadow-none"
                  >
                    <option value="all">All categories</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  <Select
                    value={risk}
                    onChange={(event) => setRisk(event.target.value as RiskLevel | "all")}
                    className="h-9 rounded-lg py-2 text-xs shadow-none"
                  >
                    <option value="all">All risk</option>
                    <option value="urgent">Urgent</option>
                    <option value="serious">Serious</option>
                    <option value="watch">Watch</option>
                    <option value="low">Cleared</option>
                  </Select>
                </div>
              </div>

              {notice ? (
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">{notice}</div>
              ) : null}
            </div>

            <div className="civic-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
              {filteredReports.length ? (
                <div className="grid gap-2">
                  {filteredReports.map((report) => (
                    <HazardListItem
                      key={report.id}
                      report={report}
                      audience={audience}
                      selected={report.cluster_id === selected?.id}
                      onSelect={() => {
                        if (report.cluster_id) setSelectedId(report.cluster_id);
                      }}
                      onVote={voteOnReport}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <div>
                    <AlertTriangle className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-950">No hazards match.</p>
                    <p className="mt-1 text-xs text-slate-500">Try clearing filters or submit a new report.</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT: Map hero */}
          <section data-command-column="map" className="relative flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
            <div className="grid gap-2 border-b border-slate-200 bg-white/95 px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-base font-black tracking-[-0.03em] text-slate-950">Live Hazard Map</h1>
                  <p className="text-[11px] text-slate-500">
                    {audience === "citizen"
                      ? "Citizen-facing map. Pulse = avoid, color = severity."
                      : "Operational view. Numbers = AI risk scores for prioritization."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AudienceToggle value={audience} onChange={setAudience} />
                </div>
              </div>
              <LocationSearch onPick={pickLocation} />
            </div>

            <div className="relative min-h-0 flex-1">
              <RealMap
                clusters={filteredClusters}
                selectedId={selected?.id ?? null}
                audience={audience}
                focusLocation={focusLocation}
                onSelect={(id) => setSelectedId(id)}
              />
              <MapLegendStrip />
              <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 md:inline-flex">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                AI-evaluated
              </div>
            </div>
          </section>
        </div>
      </div>

      {submitMode ? (
        <div data-submit-overlay="true" className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-slate-950/45 p-3 sm:p-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}
