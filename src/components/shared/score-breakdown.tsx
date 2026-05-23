import type { ScoreBreakdown } from "@/lib/types";

import { Card } from "@/components/ui/primitives";

export function ScoreBreakdown({ score }: { score: ScoreBreakdown }) {
  return (
    <Card className="grid gap-6 p-5">
      <div className="grid gap-2">
        <h3 className="text-lg font-semibold text-slate-950">Score Breakdown</h3>
        <p className="text-sm leading-7 text-slate-600">{score.risk_reason}</p>
        <p className="text-sm leading-7 text-slate-500">{score.confidence_reason}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Risk Factors</p>
          {score.risk_factors.map((factor) => (
            <div key={`${factor.label}-${factor.value}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-700">{factor.label}</span>
              <span className={factor.value >= 0 ? "font-semibold text-blue-700" : "font-semibold text-rose-700"}>{factor.value >= 0 ? `+${factor.value}` : factor.value}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Confidence Factors</p>
          {score.confidence_factors.map((factor) => (
            <div key={`${factor.label}-${factor.value}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-700">{factor.label}</span>
              <span className={factor.value >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{factor.value >= 0 ? `+${factor.value}` : factor.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
