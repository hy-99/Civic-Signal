import type { AnalysisJson, ScoreBreakdown } from "@/lib/types";

import { Card } from "@/components/ui/primitives";

const authenticityLabel: Record<string, string> = {
  likely_authentic: "Likely authentic",
  possibly_edited: "Possibly edited",
  unclear: "Unclear",
};

const authenticityColor: Record<string, string> = {
  likely_authentic: "text-emerald-700",
  possibly_edited: "text-amber-700",
  unclear: "text-slate-500",
};

function dangerLabel(score: number) {
  if (score >= 86) return { text: "Critical", color: "bg-rose-100 text-rose-800" };
  if (score >= 71) return { text: "Severe", color: "bg-rose-50 text-rose-700" };
  if (score >= 51) return { text: "Serious", color: "bg-orange-50 text-orange-700" };
  if (score >= 31) return { text: "Moderate", color: "bg-amber-50 text-amber-700" };
  if (score >= 16) return { text: "Minor", color: "bg-yellow-50 text-yellow-700" };
  return { text: "Low", color: "bg-emerald-50 text-emerald-700" };
}

export function ScoreBreakdown({ imageAnalysis }: { score: ScoreBreakdown; imageAnalysis?: AnalysisJson["image_analysis"] }) {
  if (!imageAnalysis) return null;

  const label = dangerLabel(imageAnalysis.danger_score);

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-950">AI Image Analysis</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${label.color}`}>{label.text} Risk</span>
      </div>

      {/* Danger score bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Danger Score</span>
          <span className={`text-2xl font-black ${
            imageAnalysis.danger_score >= 71 ? "text-rose-700" :
            imageAnalysis.danger_score >= 51 ? "text-orange-600" :
            imageAnalysis.danger_score >= 31 ? "text-amber-600" :
            "text-emerald-700"
          }`}>
            {imageAnalysis.danger_score}<span className="text-sm font-semibold text-slate-400"> / 100</span>
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              imageAnalysis.danger_score >= 71 ? "bg-rose-500" :
              imageAnalysis.danger_score >= 51 ? "bg-orange-500" :
              imageAnalysis.danger_score >= 31 ? "bg-amber-500" :
              "bg-emerald-500"
            }`}
            style={{ width: `${imageAnalysis.danger_score}%` }}
          />
        </div>
      </div>

      {/* Danger reasoning */}
      {imageAnalysis.danger_reasoning ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">Danger Assessment</p>
          <p className="text-sm leading-6 text-slate-700">{imageAnalysis.danger_reasoning}</p>
        </div>
      ) : null}

      {/* Danger factors */}
      {imageAnalysis.danger_factors?.length ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold text-slate-500">Contributing Factors</p>
          {imageAnalysis.danger_factors.map((factor, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="mt-0.5 shrink-0 text-slate-400">•</span>
              {factor}
            </div>
          ))}
        </div>
      ) : null}

      {/* Meta row */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Confirms Hazard</span>
          <span className={`font-semibold ${imageAnalysis.confirms_hazard ? "text-emerald-700" : "text-rose-700"}`}>
            {imageAnalysis.confirms_hazard ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Evidence</span>
          <span className={`font-semibold ${imageAnalysis.evidence_score >= 60 ? "text-emerald-700" : imageAnalysis.evidence_score >= 30 ? "text-amber-600" : "text-rose-700"}`}>
            {imageAnalysis.evidence_score} / 100
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Authenticity</span>
          <span className={`font-semibold ${authenticityColor[imageAnalysis.authenticity_flag] || "text-slate-500"}`}>
            {authenticityLabel[imageAnalysis.authenticity_flag] || imageAnalysis.authenticity_flag}
          </span>
        </div>
      </div>

      {/* PII warning */}
      {imageAnalysis.pii_detected ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-semibold text-amber-800">PII Detected</span>
          <span className="text-amber-700">{imageAnalysis.pii_types.join(", ")}</span>
        </div>
      ) : null}

      {/* Details observed */}
      {imageAnalysis.details_observed ? (
        <p className="text-sm leading-6 text-slate-500">{imageAnalysis.details_observed}</p>
      ) : null}

      {/* Recommended action */}
      {imageAnalysis.recommended_action ? (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <span className="font-semibold">Action: </span>{imageAnalysis.recommended_action}
        </p>
      ) : null}
    </Card>
  );
}
