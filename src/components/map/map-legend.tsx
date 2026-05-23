import { RiskBadge, StatusBadge } from "@/components/shared/badges";

export function MapLegend() {
  return (
    <div className="civic-light-card grid gap-4 rounded-[2rem] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Legend</p>
        <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">Risk and status</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <RiskBadge risk_level="low" />
        <RiskBadge risk_level="watch" />
        <RiskBadge risk_level="serious" />
        <RiskBadge risk_level="urgent" />
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status="active" />
        <StatusBadge status="needs_review" />
        <StatusBadge status="resolved" />
      </div>
    </div>
  );
}
