"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Search,
  X,
} from "lucide-react";

import { CATEGORY_OPTIONS } from "@/lib/constants";
import type { AuthViewer, CaseEvent, CaseOpsRoleMode, DangerZone, IncidentCase, IncidentCaseStatus, ReportCardView, ReportCategoryKey, RiskClusterView, RiskLevel } from "@/lib/types";
import type { RiskClusterMapStats } from "@/services/clusters";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useEventStream } from "@/hooks/use-event-stream";
import { RiskBadge, StatusBadge } from "@/components/shared/badges";
import { RealMap, type FocusLocation, type MapAudience } from "@/components/map/real-map";
import { LocationSearch, type LocationOption } from "@/components/map/location-search";
import { useSettings } from "@/components/providers/settings-provider";
import { Button, Input, Select, Textarea } from "@/components/ui/primitives";

type CommandCenterProps = {
  clusters: RiskClusterView[];
  reports: ReportCardView[];
  cases?: IncidentCase[];
  zones?: DangerZone[];
  caseEvents?: CaseEvent[];
  viewer?: AuthViewer | null;
  clusterStats?: RiskClusterMapStats;
  submitMode?: boolean;
  children?: React.ReactNode;
};

type ResponderClusterAction = "mark_verified" | "mark_in_progress" | "mark_resolved";

type ReportAction =
  | { kind: "citizen"; vote: "confirm" | "resolved" }
  | { kind: "responder"; cluster_action: ResponderClusterAction; cluster_id: string | null };

type CaseActionStatus = "assigned" | "field_verification" | "active_response" | "resolved" | "false_alarm" | "escalated";
type CityHazardAreaPreset = "downtown" | "mission" | "waterfront" | "westside" | "citywide";
type CityHazardZoneKind = "official_active_zone" | "official_predicted_zone";

type GovActionToast = {
  id: string;
  tone: "verified" | "progress" | "resolved";
  title: string;
  detail: string;
};

function verifiedGlowClass(riskLevel: RiskLevel) {
  if (riskLevel === "urgent") {
    return "shadow-[0_0_0_1.75px_rgba(239,68,68,0.42),0_0_28px_5px_rgba(239,68,68,0.2)]";
  }
  if (riskLevel === "serious") {
    return "shadow-[0_0_0_1.75px_rgba(249,115,22,0.42),0_0_28px_5px_rgba(249,115,22,0.2)]";
  }
  if (riskLevel === "watch") {
    return "shadow-[0_0_0_1.75px_rgba(234,179,8,0.46),0_0_28px_5px_rgba(234,179,8,0.22)]";
  }
  return "shadow-[0_0_0_1.75px_rgba(245,158,11,0.44),0_0_28px_5px_rgba(245,158,11,0.2)]";
}

function govActionCopy(action: ResponderClusterAction, reportTitle: string) {
  const shortTitle = reportTitle.length > 58 ? `${reportTitle.slice(0, 55)}…` : reportTitle;
  if (action === "mark_verified") {
    return {
      tone: "verified" as const,
      title: "Government verified hazard",
      detail: `${shortTitle} now appears as officially confirmed for citizens.`,
    };
  }
  if (action === "mark_in_progress") {
    return {
      tone: "progress" as const,
      title: "Response marked in progress",
      detail: `${shortTitle} now shows a blue response status on the public map.`,
    };
  }
  return {
    tone: "resolved" as const,
    title: "Hazard removed from public map",
    detail: `${shortTitle} is now cleared from citizen-facing map results.`,
  };
}

function govToastClass(tone: GovActionToast["tone"]) {
  if (tone === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-200/70";
  if (tone === "progress") return "border-sky-200 bg-sky-50 text-sky-900 shadow-sky-200/70";
  return "border-rose-200 bg-rose-50 text-rose-900 shadow-rose-200/70";
}

function govToastDotClass(tone: GovActionToast["tone"]) {
  if (tone === "verified") return "bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.42)]";
  if (tone === "progress") return "bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.42)]";
  return "bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.42)]";
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function polygonAroundCluster(cluster: RiskClusterView, scale = 0.002) {
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [cluster.longitude - scale, cluster.latitude - scale * 0.55],
        [cluster.longitude - scale * 0.25, cluster.latitude + scale],
        [cluster.longitude + scale * 1.05, cluster.latitude + scale * 0.4],
        [cluster.longitude + scale * 0.7, cluster.latitude - scale * 0.95],
        [cluster.longitude - scale, cluster.latitude - scale * 0.55],
      ],
    ],
  };
}

const CITY_HAZARD_AREAS: Record<CityHazardAreaPreset, { label: string; description: string; coordinates: [number, number][] }> = {
  downtown: {
    label: "Downtown / Civic core",
    description: "Covers downtown streets, civic buildings, and nearby transit corridors.",
    coordinates: [
      [-122.424, 37.795],
      [-122.395, 37.795],
      [-122.392, 37.775],
      [-122.415, 37.766],
      [-122.432, 37.779],
      [-122.424, 37.795],
    ],
  },
  mission: {
    label: "Mission / central corridor",
    description: "Useful for police response, public disturbance, crowd, road, or smoke advisories.",
    coordinates: [
      [-122.426, 37.772],
      [-122.398, 37.771],
      [-122.399, 37.742],
      [-122.424, 37.739],
      [-122.437, 37.753],
      [-122.426, 37.772],
    ],
  },
  waterfront: {
    label: "Waterfront / Embarcadero",
    description: "Useful for storms, flooding, event crowding, smoke, ferry-area issues, and closures.",
    coordinates: [
      [-122.405, 37.812],
      [-122.383, 37.808],
      [-122.378, 37.777],
      [-122.392, 37.762],
      [-122.410, 37.782],
      [-122.405, 37.812],
    ],
  },
  westside: {
    label: "West-side neighborhoods",
    description: "Covers western residential corridors, parks, storm impacts, and road closures.",
    coordinates: [
      [-122.515, 37.791],
      [-122.448, 37.79],
      [-122.445, 37.728],
      [-122.506, 37.716],
      [-122.528, 37.748],
      [-122.515, 37.791],
    ],
  },
  citywide: {
    label: "Citywide advisory",
    description: "Use only for broad hazards such as storm, air quality, smoke, flood, or major emergency advisories.",
    coordinates: [
      [-122.522, 37.812],
      [-122.36, 37.812],
      [-122.356, 37.703],
      [-122.512, 37.702],
      [-122.535, 37.755],
      [-122.522, 37.812],
    ],
  },
};

function cityAreaGeometry(preset: CityHazardAreaPreset) {
  return {
    type: "Polygon" as const,
    coordinates: [CITY_HAZARD_AREAS[preset].coordinates],
  };
}

function riskToScore(risk: RiskLevel) {
  if (risk === "urgent") return 88;
  if (risk === "serious") return 68;
  if (risk === "watch") return 42;
  return 20;
}

function isPoliceMode(roleMode: CaseOpsRoleMode) {
  return roleMode === "police" || roleMode === "responder";
}

const AUDIENCE_COPY = {
  citizen: {
    sidebarEyebrow: "Citizen view",
    sidebarTitle: "Hazards near you",
    sidebarHelp: "Avoid risky areas, or tap Verify / Not there to help keep the map accurate.",
    stats: [
      { key: "active", label: "Active", tone: "bg-blue-50 text-blue-700" },
      { key: "urgent", label: "Avoid", tone: "bg-rose-50 text-rose-700" },
      { key: "resolved", label: "Cleared", tone: "bg-emerald-50 text-emerald-700" },
    ],
  },
  responder: {
    sidebarEyebrow: "Government / Police view",
    sidebarTitle: "Active incidents",
    sidebarHelp: "Confirm, mark in progress, or remove hazards that are gone or incorrect.",
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
  roleMode,
  caseId,
  priorityRank,
  onSelect,
  onAction,
  onCreateCase,
  onCaseStatus,
}: {
  report: ReportCardView;
  selected: boolean;
  audience: MapAudience;
  roleMode: CaseOpsRoleMode;
  caseId: string | null;
  priorityRank?: number;
  onSelect: () => void;
  onAction: (reportId: string, action: ReportAction) => void;
  onCreateCase: (report: ReportCardView) => void;
  onCaseStatus: (caseId: string, status: CaseActionStatus, label: string) => void;
}) {
  const clusterRiskLevel = report.cluster?.risk_level ?? report.risk_level;
  const displayRiskLevel = audience === "responder" ? clusterRiskLevel : report.risk_level;
  const displayStatus = audience === "responder" ? report.cluster?.status ?? report.status : report.status;
  const displayRiskScore = audience === "responder" ? report.cluster?.risk_score ?? report.risk_score : report.risk_score;
  const displayConfidenceScore = audience === "responder" ? report.cluster?.confidence_score ?? report.confidence_score : report.confidence_score;
  const evidenceLabel = report.cluster
    ? `${pluralize(report.cluster.report_count, "report")} · ${pluralize(report.cluster.signal_count, "signal")}`
    : "Single report";
  const detailsHref = audience === "responder" && report.cluster_id ? `/app/risks/${report.cluster_id}` : `/app/reports/${report.id}`;
  const riskAccent =
    displayRiskLevel === "urgent"
      ? "border-l-rose-500"
      : displayRiskLevel === "serious"
        ? "border-l-orange-500"
        : displayRiskLevel === "watch"
          ? "border-l-yellow-400"
          : "border-l-slate-300";

  // Government status is cluster-level, so the card halo mirrors the same
  // cluster risk color used by the map pin instead of the individual report.
  const clusterStatus = report.cluster?.status;
  let govGlow: string | null = null;
  if (clusterStatus === "in_progress") {
    govGlow = "shadow-[0_0_0_1.75px_rgba(37,99,235,0.42),0_0_28px_5px_rgba(37,99,235,0.2)]";
  } else if (clusterStatus === "verified") {
    govGlow = verifiedGlowClass(clusterRiskLevel);
  }

  return (
    <article
      onClick={onSelect}
      className={cn(
        "cursor-pointer overflow-hidden rounded-xl border border-l-4 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        riskAccent,
        govGlow,
        selected ? "border-blue-400 bg-blue-50 ring-2 ring-blue-300 shadow-md" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {audience === "responder" && priorityRank ? (
              <span
                className={cn(
                  "inline-flex h-5 min-w-[28px] items-center justify-center rounded-md px-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-white",
                  priorityRank === 1
                    ? "bg-rose-600"
                    : priorityRank === 2
                      ? "bg-orange-500"
                      : "bg-amber-500",
                )}
                title={`Priority rank #${priorityRank}`}
              >
                #{priorityRank}
              </span>
            ) : null}
            <h3 className="truncate text-sm font-black leading-5 tracking-[-0.01em] text-slate-950">{report.title}</h3>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
            {report.analysis_summary || report.description}
          </p>
        </div>
        {audience === "responder" ? (
          <div className="grid gap-1 justify-items-end">
            <div className="grid place-items-center rounded-lg bg-slate-900 px-2 py-1 text-xs font-black text-white">
              {displayRiskScore}
            </div>
            <StatusBadge status={displayStatus} />
          </div>
        ) : (
          <div className="grid gap-1 justify-items-end">
            <RiskBadge risk_level={report.risk_level} />
            <StatusBadge status={report.status} />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="truncate">{report.address_text || "Location pending"}</span>
        <span>{formatRelativeTime(report.updated_at)}</span>
        {audience === "responder" ? (
          <>
            <span>Conf {displayConfidenceScore}</span>
            <span>{report.vote_summary.confirm} ✓ {report.vote_summary.dispute} ✗</span>
            <span>{evidenceLabel}</span>
          </>
        ) : (
          <span>{report.vote_summary.confirm} verified</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
        {roleMode === "citizen" ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(report.id, { kind: "citizen", vote: "confirm" });
              }}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm shadow-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(report.id, { kind: "citizen", vote: "resolved" });
              }}
              className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900"
            >
              Not there
            </button>
          </>
        ) : roleMode === "moderator" ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCreateCase(report);
              }}
              className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700 shadow-sm shadow-violet-100 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-100"
            >
              {caseId ? "Open case" : "Create case"}
            </button>
            {caseId ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCaseStatus(caseId, "assigned", "assigned by moderator");
                }}
                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 shadow-sm shadow-blue-100 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100"
              >
                Assign
              </button>
            ) : null}
          </>
        ) : roleMode === "government" ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(report.id, { kind: "responder", cluster_action: "mark_verified", cluster_id: report.cluster_id });
              }}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm shadow-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
            >
              Confirmed
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(report.id, { kind: "responder", cluster_action: "mark_in_progress", cluster_id: report.cluster_id });
              }}
              className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-black text-sky-700 shadow-sm shadow-sky-100 transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800"
            >
              In progress
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onAction(report.id, { kind: "responder", cluster_action: "mark_resolved", cluster_id: report.cluster_id });
              }}
              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-700 shadow-sm shadow-rose-100 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800"
            >
              Remove
            </button>
          </>
        ) : (
          <>
            {caseId ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCaseStatus(caseId, "field_verification", "case accepted for field verification");
                  }}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 shadow-sm shadow-blue-100 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCaseStatus(caseId, "active_response", "field verified and active response started");
                  }}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800 shadow-sm shadow-amber-100 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100"
                >
                  On scene
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCaseStatus(caseId, "resolved", "resolved by responder");
                  }}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 shadow-sm shadow-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
                >
                  Resolve
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCreateCase(report);
                }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-100"
              >
                Need case
              </button>
            )}
          </>
        )}
        <Link
          href={detailsHref}
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

function CityHazardModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    kind: CityHazardZoneKind;
    area: CityHazardAreaPreset;
    severity: RiskLevel;
    instructions: string;
  }) => void;
}) {
  const [title, setTitle] = useState("Citywide storm advisory");
  const [kind, setKind] = useState<CityHazardZoneKind>("official_active_zone");
  const [area, setArea] = useState<CityHazardAreaPreset>("citywide");
  const [severity, setSeverity] = useState<RiskLevel>("serious");
  const [instructions, setInstructions] = useState("Avoid exposed streets, check official updates, and use safer alternate routes.");
  const selectedArea = CITY_HAZARD_AREAS[area];

  const submit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onCreate({
      title: cleanTitle,
      kind,
      area,
      severity,
      instructions: instructions.trim() || "Avoid the highlighted zone until government updates the alert.",
    });
  };

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add city-level hazard">
      <section className="grid max-h-[calc(100vh-32px)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_36px_90px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_0.85fr]">
        <div className="overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Government city-level hazard</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">Publish an official map overlay</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use this for broad hazards that should appear as a filter/overlay for everyone, like storm, flood, smoke, closure, or emergency advisories.
              </p>
            </div>
            <button type="button" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" onClick={onClose} aria-label="Close city hazard panel">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-black text-slate-900">Hazard title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl" placeholder="Citywide storm advisory" />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-900">Zone type</span>
                <Select value={kind} onChange={(event) => setKind(event.target.value as CityHazardZoneKind)} className="rounded-xl">
                  <option value="official_active_zone">Active now</option>
                  <option value="official_predicted_zone">Predicted impact</option>
                </Select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-900">Map area</span>
                <Select value={area} onChange={(event) => setArea(event.target.value as CityHazardAreaPreset)} className="rounded-xl">
                  {Object.entries(CITY_HAZARD_AREAS).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-900">Severity</span>
                <Select value={severity} onChange={(event) => setSeverity(event.target.value as RiskLevel)} className="rounded-xl">
                  <option value="watch">Watch</option>
                  <option value="serious">Serious</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-black text-slate-900">Public instructions</span>
              <Textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="min-h-[104px] rounded-xl"
                placeholder="Tell citizens what to avoid and what safer action to take."
              />
            </label>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              <span className="font-black text-slate-900">Selected area: </span>
              {selectedArea.description}
            </div>
          </div>
        </div>

        <aside className="grid content-between gap-4 border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Overlay preview</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-[#dceff8] shadow-inner">
              <svg viewBox="0 0 300 260" className="h-[260px] w-full">
                <defs>
                  <pattern id="city-hazard-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                    <path d="M18 0H0V18" fill="none" stroke="rgba(71,85,105,0.14)" />
                  </pattern>
                </defs>
                <rect width="300" height="260" fill="#dceff8" />
                <rect width="300" height="260" fill="url(#city-hazard-grid)" />
                <path d="M20 204 C78 156 124 144 174 110 S238 74 286 46" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="18" strokeLinecap="round" />
                <path d="M20 204 C78 156 124 144 174 110 S238 74 286 46" fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="9 7" />
                <path d="M70 22 L92 78 L86 150 L122 232" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="11" strokeLinecap="round" />
                <path d="M206 16 L190 74 L206 128 L184 242" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="9" strokeLinecap="round" />
                <polygon
                  points={area === "citywide" ? "34,34 270,40 274,218 38,228 18,132" : area === "waterfront" ? "172,26 280,42 258,182 198,220 168,120" : area === "mission" ? "86,96 210,92 228,204 92,224 62,164" : area === "westside" ? "24,54 142,48 126,222 28,212 8,128" : "86,50 220,58 214,164 106,194 66,118"}
                  fill={title.toLowerCase().includes("storm") || title.toLowerCase().includes("flood") || title.toLowerCase().includes("weather") ? "rgba(37,99,235,0.24)" : "rgba(239,68,68,0.2)"}
                  stroke={title.toLowerCase().includes("storm") || title.toLowerCase().includes("flood") || title.toLowerCase().includes("weather") ? "#2563eb" : "#ef4444"}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <text x="18" y="244" className="fill-slate-700 text-[11px] font-black">
                  {kind === "official_active_zone" ? "official active overlay" : "official predicted overlay"}
                </text>
              </svg>
            </div>
          </div>
          <div className="grid gap-2">
            <Button type="button" className="rounded-xl bg-[#0f2f55] px-4 py-3 text-white hover:bg-[#123a69]" onClick={submit}>
              Publish city-level hazard
            </Button>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}

function roleModeToAudience(roleMode: CaseOpsRoleMode): MapAudience {
  return roleMode === "citizen" ? "citizen" : "responder";
}

const ROLE_MODE_LABELS: Record<CaseOpsRoleMode, string> = {
  citizen: "Citizen",
  police: "Police",
  moderator: "Moderator / Dispatcher",
  government: "Government / Admin",
  responder: "Responder",
};

const PUBLIC_ZONE_TYPES = new Set<DangerZone["type"]>([
  "official_active_zone",
  "official_predicted_zone",
  "safe_zone",
  "evacuation_route",
  "road_closure",
  "shelter_area",
]);

const ROLE_HELP: Record<CaseOpsRoleMode, { title: string; body: string }> = {
  citizen: {
    title: "Public-safe view",
    body: "Citizens can submit evidence, verify hazards, dispute stale items, and see official public zones.",
  },
  police: {
    title: "Police response",
    body: "Police can accept cases, mark on-scene status, add private notes, request support, and resolve or flag false alarms.",
  },
  moderator: {
    title: "Dispatcher workflow",
    body: "Moderators convert reports or clusters into cases, review sensitive content, and assign owners.",
  },
  government: {
    title: "Official coordination",
    body: "Government users publish active/predicted zones, approve public alerts, and coordinate departments.",
  },
  responder: {
    title: "Field response",
    body: "Responders accept cases, mark on-scene/verified status, add private notes, escalate, or close cases.",
  },
};

export function CommandCenter({ clusters, reports, cases = [], zones = [], caseEvents = [], viewer, clusterStats, submitMode = false, children }: CommandCenterProps) {
  const router = useRouter();
  const { roleMode } = useSettings();
  const viewerLabel = viewer?.display_name || "Demo operator";
  // Start with no cluster selected so we don't auto-highlight any pins or
  // cards on first load. The user picks what they want to focus on.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReportCategoryKey | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const audience = roleModeToAudience(roleMode);
  const [notice, setNotice] = useState("");
  const [govActionToast, setGovActionToast] = useState<GovActionToast | null>(null);
  const [focusLocation, setFocusLocation] = useState<FocusLocation | null>(null);
  const [responderNote, setResponderNote] = useState("");
  const [cityHazardOpen, setCityHazardOpen] = useState(false);
  const liveRefreshTimerRef = useRef<number | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!govActionToast) return;
    const timeout = window.setTimeout(() => setGovActionToast(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [govActionToast]);

  useEffect(() => {
    return () => {
      if (liveRefreshTimerRef.current !== null) {
        window.clearTimeout(liveRefreshTimerRef.current);
      }
    };
  }, []);

  useEventStream({
    onEvent() {
      if (submitMode) return;
      if (liveRefreshTimerRef.current !== null) return;
      liveRefreshTimerRef.current = window.setTimeout(() => {
        liveRefreshTimerRef.current = null;
        startTransition(() => {
          router.refresh();
        });
      }, 250);
    },
  });

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

  const selected = selectedId ? filteredClusters.find((cluster) => cluster.id === selectedId) || null : null;
  const selectedCase = selected ? cases.find((incident) => incident.linked_cluster_id === selected.id) || null : null;
  const selectedCaseEvents = selectedCase
    ? caseEvents.filter((event) => {
        if (roleMode === "citizen" && event.metadata?.private === true) return false;
        return event.case_id === selectedCase.id;
      })
    : [];
  const visibleZones = useMemo(
    () => (roleMode === "citizen" ? zones.filter((zone) => PUBLIC_ZONE_TYPES.has(zone.type)) : zones),
    [roleMode, zones],
  );

  const filteredReports = useMemo(() => {
    const queryText = query.toLowerCase();
    return reports
      .filter((report) => (category === "all" ? true : report.category === category))
      .filter((report) => (risk === "all" ? true : report.risk_level === risk))
      .filter((report) => `${report.title} ${report.description} ${report.address_text || ""}`.toLowerCase().includes(queryText))
      .sort((a, b) => b.risk_score - a.risk_score || b.confidence_score - a.confidence_score);
  }, [category, query, reports, risk]);

  const sidebarReports = useMemo(() => {
    if (audience === "citizen") return filteredReports;
    const seenClusterIds = new Set<string>();
    return filteredReports.filter((report) => {
      const key = report.cluster_id || `report:${report.id}`;
      if (seenClusterIds.has(key)) return false;
      seenClusterIds.add(key);
      return true;
    });
  }, [audience, filteredReports]);

  // Rank the top 3 most urgent visible hazards by risk_score so responders
  // see one priority row per cluster, not one row per duplicate report.
  const priorityRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    const open = ["active", "needs_review", "verified"] as const;
    const candidates = sidebarReports
      .filter((report) => (open as readonly string[]).includes(report.status))
      .slice(0, 3);
    candidates.forEach((report, index) => ranks.set(report.id, index + 1));
    return ranks;
  }, [sidebarReports]);

  const activeCount = clusterStats?.active ?? clusters.length;
  const urgentCount = clusterStats?.urgent ?? clusters.filter((cluster) => cluster.risk_level === "urgent" || cluster.risk_level === "serious").length;
  const resolvedCount = clusterStats?.cleared ?? 0;

  const audienceCopy = AUDIENCE_COPY[audience];
  const statValues = { active: activeCount, urgent: urgentCount, resolved: resolvedCount } as Record<string, number>;

  const handleReportAction = (reportId: string, action: ReportAction) => {
    if (action.kind === "responder" && !action.cluster_id) {
      setNotice("This report isn't linked to a cluster yet, so it can't be marked on the map.");
      return;
    }
    startTransition(async () => {
      const actedReport = reports.find((report) => report.id === reportId) || null;
      const response =
        action.kind === "citizen"
          ? await fetch(`/api/reports/${reportId}/vote`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vote_type: action.vote }),
            })
          : await fetch(`/api/admin/moderate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                target_type: "cluster",
                target_id: action.cluster_id,
                action: action.cluster_action,
              }),
            });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      const label =
        action.kind === "citizen"
          ? action.vote === "confirm"
            ? "verified"
            : "marked not there"
          : action.cluster_action === "mark_verified"
            ? "marked as verified (pin gets a confirmed-risk glow)"
            : action.cluster_action === "mark_in_progress"
              ? "marked in progress (pin glows blue)"
              : "marked resolved (removed from the map)";
      setNotice(payload.ok ? `Saved: ${label}.` : payload.error || "Unable to update hazard.");
      if (payload.ok) {
        if (action.kind === "responder") {
          const copy = govActionCopy(action.cluster_action, actedReport?.title || "Selected hazard");
          const toast: GovActionToast = {
            id: `${action.cluster_action}:${action.cluster_id}:${Date.now()}`,
            ...copy,
          };
          setGovActionToast(toast);
          window.dispatchEvent(
            new CustomEvent("civicsignal:gov-action", {
              detail: {
                id: toast.id,
                tone: toast.tone,
                title: toast.title,
                detail: toast.detail,
                href: actedReport ? `/app/reports/${actedReport.id}` : undefined,
              },
            }),
          );
        }
        router.refresh();
      }
    });
  };

  const handleMapSelect = (id: string) => {
    // Toggle behavior: clicking the same item again deselects it
    setSelectedId(selectedId === id ? null : id);
  };

  const handleCaseStatus = (caseId: string, status: IncidentCaseStatus, label: string) => {
    startTransition(async () => {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? `CaseOps: ${label}.` : payload.error || "Unable to update case.");
      if (payload.ok) router.refresh();
    });
  };

  const handleCreateCase = (report: ReportCardView) => {
    startTransition(async () => {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report.cluster_id ? { cluster_id: report.cluster_id } : { report_id: report.id }),
      });
      const payload = (await response.json()) as { ok: boolean; data?: IncidentCase; error?: string };
      setNotice(payload.ok ? "CaseOps: managed case created or opened." : payload.error || "Unable to create case.");
      if (payload.ok) {
        if (report.cluster_id) setSelectedId(report.cluster_id);
        router.refresh();
      }
    });
  };

  const handlePublicAlert = (caseId: string, approve: boolean) => {
    startTransition(async () => {
      const response = await fetch(`/api/uipath/cases/${caseId}/public-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve,
          summary: approve ? "Government approved a public alert for this case." : "Government drafted a public alert for review.",
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? (approve ? "Public alert approved." : "Public alert drafted.") : payload.error || "Unable to update public alert.");
      if (payload.ok) router.refresh();
    });
  };

  const handleResponderNote = (caseId: string) => {
    const note = responderNote.trim();
    if (!note) {
      setNotice("Write a responder note before saving.");
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/cases/${caseId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_type: "responder",
          actor_label: "Responder private note",
          action: "field_verified",
          summary: note,
          metadata: { private: true },
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? "Private responder note saved." : payload.error || "Unable to save note.");
      if (payload.ok) {
        setResponderNote("");
        router.refresh();
      }
    });
  };

  const handleZonePublish = (cluster: RiskClusterView, incident: IncidentCase, kind: "active" | "predicted") => {
    startTransition(async () => {
      const type = kind === "active" ? "official_active_zone" : "official_predicted_zone";
      const response = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: incident.id,
          report_id: null,
          cluster_id: cluster.id,
          type,
          geometry: polygonAroundCluster(cluster, kind === "active" ? 0.0021 : 0.003),
          label: kind === "active" ? "Official active danger zone" : "Official predicted impact zone",
          severity: cluster.risk_score,
          confidence: cluster.confidence_score,
          starts_at: kind === "active" ? new Date().toISOString() : null,
          expires_at: null,
          estimated_arrival_at: kind === "predicted" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
          instructions:
            kind === "active"
              ? "Avoid this area until officials update the case."
              : "This is a planning forecast zone, not confirmed impact.",
          created_by_role: "government",
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? `Government zone published: ${kind}.` : payload.error || "Unable to publish zone.");
      if (payload.ok) router.refresh();
    });
  };

  const handleCityHazardCreate = (input: {
    title: string;
    kind: CityHazardZoneKind;
    area: CityHazardAreaPreset;
    severity: RiskLevel;
    instructions: string;
  }) => {
    startTransition(async () => {
      const response = await fetch("/api/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: null,
          report_id: null,
          cluster_id: null,
          type: input.kind,
          geometry: cityAreaGeometry(input.area),
          label: input.title,
          severity: riskToScore(input.severity),
          confidence: 92,
          starts_at: new Date().toISOString(),
          expires_at: null,
          estimated_arrival_at: input.kind === "official_predicted_zone" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null,
          instructions: input.instructions,
          created_by_role: "government",
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setNotice(payload.ok ? "Government city-level hazard published to the public map." : payload.error || "Unable to publish city-level hazard.");
      if (payload.ok) {
        setCityHazardOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div className={cn("civic-map-entrance relative h-full min-h-0 overflow-y-auto bg-[#eef3f8] lg:overflow-hidden", submitMode && "pointer-events-none select-none")}>
      {cityHazardOpen ? (
        <CityHazardModal
          onClose={() => setCityHazardOpen(false)}
          onCreate={handleCityHazardCreate}
        />
      ) : null}
      {govActionToast ? (
        <aside
          className={cn(
            "civic-gov-action-toast pointer-events-none absolute right-4 top-4 z-30 max-w-[340px] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md",
            govToastClass(govActionToast.tone),
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", govToastDotClass(govActionToast.tone))} aria-hidden="true" />
            <div>
              <p className="text-sm font-black tracking-[-0.01em]">{govActionToast.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 opacity-80">{govActionToast.detail}</p>
            </div>
          </div>
        </aside>
      ) : null}
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
                {roleMode === "government" ? (
                  <div className="grid shrink-0 gap-1.5">
                    <Link href="/app/submit">
                      <Button className="h-8 rounded-lg px-3 text-xs">Add report</Button>
                    </Link>
                    <Button
                      type="button"
                      className="h-8 rounded-lg bg-[#0f2f55] px-3 text-xs text-white hover:bg-[#123a69]"
                      onClick={() => setCityHazardOpen(true)}
                    >
                      City-level hazard
                    </Button>
                  </div>
                ) : (
                  <Link href="/app/submit">
                    <Button className="h-8 rounded-lg px-3 text-xs">+ Report</Button>
                  </Link>
                )}
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

              <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-blue-700" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">CaseOps mode</p>
                    <p className="text-sm font-black text-slate-950">{ROLE_MODE_LABELS[roleMode]}</p>
                    <p className="text-[11px] font-semibold text-slate-500">{viewerLabel}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-slate-600">
                  <span className="rounded-lg bg-white px-2 py-1.5 shadow-sm">{cases.length} cases</span>
                  <span className="rounded-lg bg-white px-2 py-1.5 shadow-sm">{visibleZones.length} zones</span>
                  <span className="rounded-lg bg-white px-2 py-1.5 shadow-sm">{roleMode === "citizen" ? "Public-safe" : "Ops layers"}</span>
                </div>
                <div className="mt-2 rounded-lg border border-white/70 bg-white/70 px-2 py-2">
                  <p className="text-[11px] font-black text-slate-900">{ROLE_HELP[roleMode].title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{ROLE_HELP[roleMode].body}</p>
                </div>
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

            <div className="civic-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none p-2">
              {sidebarReports.length ? (
                <div className="grid gap-2">
                  {sidebarReports.map((report) => (
                    <HazardListItem
                      key={audience === "responder" ? report.cluster_id || report.id : report.id}
                      report={report}
                      audience={audience}
                      roleMode={roleMode}
                      caseId={
                        report.linked_case_id ||
                        (report.cluster_id ? cases.find((incident) => incident.linked_cluster_id === report.cluster_id)?.id || null : null)
                      }
                      priorityRank={priorityRanks.get(report.id)}
                      selected={report.cluster_id === selected?.id}
                      onSelect={() => {
                        if (report.cluster_id) {
                          handleMapSelect(report.cluster_id);
                        }
                      }}
                      onAction={handleReportAction}
                      onCreateCase={handleCreateCase}
                      onCaseStatus={handleCaseStatus}
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
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700">
                    {ROLE_MODE_LABELS[roleMode]}
                  </span>
                </div>
              </div>
              <LocationSearch onPick={pickLocation} />
            </div>

            <div className="relative min-h-0 flex-1">
              <RealMap
                clusters={filteredClusters}
                zones={visibleZones}
                selectedId={selected?.id ?? null}
                audience={audience}
                focusLocation={focusLocation}
                onSelect={handleMapSelect}
              />
              <MapLegendStrip />
            </div>

            {selected && (
              <div className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 cs-detail-panel">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-base font-black tracking-[-0.02em] text-slate-950">{selected.title}</h2>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    aria-label="Close detail panel"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-slate-600 mb-3">{selected.summary || `Location: ${selected.latitude.toFixed(2)}, ${selected.longitude.toFixed(2)}`}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <RiskBadge risk_level={selected.risk_level} />
                  <StatusBadge status={selected.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                  <div className="rounded-lg bg-blue-50 p-2 text-center">
                    <p className="font-bold text-blue-700">{selected.risk_score}</p>
                    <p className="text-xs text-blue-600">Risk</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 text-center">
                    <p className="font-bold text-slate-700">{selected.confidence_score}</p>
                    <p className="text-xs text-slate-600">Confidence</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 text-center">
                    <p className="font-bold text-slate-700">{selected.report_count + selected.signal_count}</p>
                    <p className="text-xs text-slate-600">Evidence</p>
                  </div>
                </div>
                {selectedCase ? (
                  <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedCase.status} />
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-700">
                        Owner: {selectedCase.owner_department || selectedCase.owner_role}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-700">
                        Alert: {selectedCase.public_alert_status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs leading-5 text-slate-600">{selectedCase.public_summary}</p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                      <div className="rounded-lg bg-white px-2 py-1.5">
                        <p className="font-black text-slate-950">{selectedCase.evidence_match}</p>
                        <p className="font-semibold text-slate-500">Evidence</p>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5">
                        <p className="font-black text-slate-950">{selectedCase.privacy_risk}</p>
                        <p className="font-semibold text-slate-500">Privacy</p>
                      </div>
                      <div className="rounded-lg bg-white px-2 py-1.5">
                        <p className="font-black text-slate-950">{selectedCase.duplicate_likelihood}</p>
                        <p className="font-semibold text-slate-500">Duplicate</p>
                      </div>
                    </div>
                    {audience === "responder" ? (
                      <p className="mt-2 text-xs leading-5 text-slate-700">
                        <span className="font-black">Responder note: </span>
                        {selectedCase.responder_summary}
                      </p>
                    ) : null}
                    {roleMode !== "citizen" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {roleMode === "government" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-black text-rose-700 shadow-sm hover:bg-rose-100"
                              onClick={() => handleZonePublish(selected, selectedCase, "active")}
                            >
                              Publish active zone
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-800 shadow-sm hover:bg-amber-100"
                              onClick={() => handleZonePublish(selected, selectedCase, "predicted")}
                            >
                              Add predicted zone
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 shadow-sm hover:bg-blue-100"
                              onClick={() => handlePublicAlert(selectedCase.id, false)}
                            >
                              Draft alert
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm hover:bg-emerald-100"
                              onClick={() => handlePublicAlert(selectedCase.id, true)}
                            >
                              Approve alert
                            </button>
                          </>
                        ) : null}
                        {isPoliceMode(roleMode) ? (
                          <>
                            <button
                              type="button"
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700 shadow-sm hover:bg-blue-100"
                              onClick={() => handleCaseStatus(selectedCase.id, "field_verification", "responder accepted / field verification")}
                            >
                              Accept case
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-800 shadow-sm hover:bg-amber-100"
                              onClick={() => handleCaseStatus(selectedCase.id, "active_response", "field verified / active response")}
                            >
                              On scene
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm hover:bg-emerald-100"
                              onClick={() => handleCaseStatus(selectedCase.id, "resolved", "resolved")}
                            >
                              Mark resolved
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm hover:bg-slate-50"
                              onClick={() => handleCaseStatus(selectedCase.id, "false_alarm", "false alarm")}
                            >
                              False alarm
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black text-orange-700 shadow-sm hover:bg-orange-100"
                              onClick={() => handleCaseStatus(selectedCase.id, "escalated", "escalated for support")}
                            >
                              Request support
                            </button>
                          </>
                        ) : null}
                        {roleMode === "moderator" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-black text-violet-700 shadow-sm hover:bg-violet-100"
                            onClick={() => handleCaseStatus(selectedCase.id, "assigned", "assigned to owner")}
                          >
                            Assign case
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {isPoliceMode(roleMode) ? (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500" htmlFor="responder-note">
                          Private responder note
                        </label>
                        <textarea
                          id="responder-note"
                          value={responderNote}
                          onChange={(event) => setResponderNote(event.target.value)}
                          className="mt-2 min-h-[64px] w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          placeholder="Visible only in operations modes, not the citizen view."
                        />
                        <button
                          type="button"
                          className="mt-2 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white shadow-sm hover:bg-slate-800"
                          onClick={() => handleResponderNote(selectedCase.id)}
                        >
                          Save private note
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Audit timeline</p>
                      <div className="mt-2 grid gap-1.5">
                        {selectedCaseEvents.slice(-4).map((event) => (
                          <div key={event.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-black text-slate-800">{event.action.replace(/_/g, " ")}</p>
                              <p className="shrink-0 text-[10px] font-semibold text-slate-400">{formatRelativeTime(event.created_at)}</p>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{event.summary}</p>
                          </div>
                        ))}
                        {!selectedCaseEvents.length ? (
                          <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
                            No timeline events are visible for this role yet.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : roleMode !== "citizen" ? (
                  <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">No managed case yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      This hazard is still a cluster. Create a CaseOps case before assignment, official zones, responder notes, or UiPath orchestration.
                    </p>
                    <button
                      type="button"
                      className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-black text-violet-700 shadow-sm hover:bg-violet-100"
                      onClick={() => {
                        const report = sidebarReports.find((item) => item.cluster_id === selected.id);
                        if (report) handleCreateCase(report);
                      }}
                    >
                      Create case from cluster
                    </button>
                  </div>
                ) : null}
                <Link href={`/app/risks/${selected.id}`} className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
                  View full details →
                </Link>
              </div>
            )}
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
