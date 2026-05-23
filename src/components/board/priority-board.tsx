"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Compass, Crosshair, Flame, MapPin, ShieldCheck, ThumbsUp, Timer } from "lucide-react";

import { DEFAULT_COORDS, CATEGORY_CONFIG } from "@/lib/constants";
import type { ReportCardView } from "@/lib/types";
import { ConfidenceBadge, RiskBadge, StatusBadge } from "@/components/shared/badges";
import { cn, formatRelativeTime, haversineDistanceMeters } from "@/lib/utils";

type SortKey = "danger" | "closest" | "recent" | "confirmed";

const SORT_OPTIONS: { key: SortKey; label: string; description: string; Icon: typeof Flame }[] = [
  { key: "danger", label: "Most Dangerous", description: "Sort by AI-scored risk", Icon: Flame },
  { key: "closest", label: "Closest to Me", description: "Sort by distance from your location", Icon: Compass },
  { key: "recent", label: "Most Recent", description: "Sort by time posted", Icon: Timer },
  { key: "confirmed", label: "Most Confirmed", description: "Sort by community confirmations", Icon: ThumbsUp },
];

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function riskAccentClass(level: ReportCardView["risk_level"]) {
  if (level === "urgent") return "border-l-rose-500";
  if (level === "serious") return "border-l-orange-500";
  if (level === "watch") return "border-l-yellow-400";
  return "border-l-slate-300";
}

export function PriorityBoard({ reports }: { reports: ReportCardView[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("danger");
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const effectiveOrigin = useMemo(
    () => origin ?? { latitude: DEFAULT_COORDS.lat, longitude: DEFAULT_COORDS.lng },
    [origin],
  );

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Location permission denied. Using city center as your origin.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 6000 },
    );
  };

  const ranked = useMemo(() => {
    const items = reports.map((report) => ({
      report,
      distance_m: haversineDistanceMeters(
        { latitude: report.latitude, longitude: report.longitude },
        effectiveOrigin,
      ),
    }));

    if (sortKey === "closest") items.sort((a, b) => a.distance_m - b.distance_m);
    else if (sortKey === "recent")
      items.sort((a, b) => +new Date(b.report.created_at) - +new Date(a.report.created_at));
    else if (sortKey === "confirmed")
      items.sort((a, b) => b.report.vote_summary.confirm - a.report.vote_summary.confirm);
    else items.sort((a, b) => b.report.risk_score - a.report.risk_score);

    return items;
  }, [reports, sortKey, effectiveOrigin]);

  const activeOption = SORT_OPTIONS.find((option) => option.key === sortKey) ?? SORT_OPTIONS[0];

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6 p-4 md:p-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Priority Board</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-950 md:text-4xl">
          Pick how the city ranks hazards for you.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Same live data, four lenses. Choose what matters most right now — danger, distance, freshness, or community confirmations — and the list reorders instantly.
        </p>
      </header>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map(({ key, label, Icon }) => {
            const isActive = key === sortKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSortKey(key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {sortKey === "closest" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Crosshair className="h-4 w-4 text-blue-700" />
              <span>
                {origin
                  ? `Using your location · ${effectiveOrigin.latitude.toFixed(3)}, ${effectiveOrigin.longitude.toFixed(3)}`
                  : `Using ${DEFAULT_COORDS.city} as your origin`}
              </span>
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              {locating ? "Locating..." : origin ? "Refresh location" : "Use my location"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{activeOption.description}.</p>
        )}

        {locationError ? <p className="text-xs text-rose-600">{locationError}</p> : null}
      </section>

      <ol className="grid gap-3">
        {ranked.map(({ report, distance_m }, index) => (
          <li key={report.id}>
            <Link
              href={`/app/reports/${report.id}`}
              className={cn(
                "grid grid-cols-[44px_1fr_auto] items-center gap-4 rounded-2xl border border-slate-200 border-l-4 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                riskAccentClass(report.risk_level),
              )}
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-base font-black text-slate-700">
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-black tracking-[-0.02em] text-slate-950">{report.title}</h3>
                  <RiskBadge risk_level={report.risk_level} />
                  <ConfidenceBadge confidence_label={report.confidence_label} />
                  <StatusBadge status={report.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                  {report.analysis_summary || report.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {report.address_text || "Location pending"}
                  </span>
                  <span>{CATEGORY_CONFIG[report.category].label}</span>
                  <span>{formatRelativeTime(report.created_at)}</span>
                  <span className="inline-flex items-center gap-1">
                    <ThumbsUp className="h-3.5 w-3.5" /> {report.vote_summary.confirm} confirmed
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5" /> {formatDistance(distance_m)} away
                  </span>
                </div>
              </div>
              <div className="grid place-items-end text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Risk</p>
                <p className="text-2xl font-black text-slate-950">{report.risk_score}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Confidence {report.confidence_score}
                </p>
              </div>
            </Link>
          </li>
        ))}
        {ranked.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No active hazards yet. Submit one from the map to see it ranked here.
          </li>
        ) : null}
      </ol>

      <footer className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-700" />
          <p>
            Ranking respects AI risk + confidence scoring. Sensitive reports are held for moderation before they appear here.
          </p>
        </div>
      </footer>
    </div>
  );
}
