import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { hasGroqConfig, hasOpenAIConfig } from "@/lib/env";
import { withMutableState } from "@/lib/data-store";
import type { AiCacheEntry, ImageAnalysisResult, PublicSignal, Report, RiskCluster } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

function hashInput(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function getCachedAIResult(cache_key: string) {
  return withMutableState((state) => state.ai_cache.find((entry) => entry.cache_key === cache_key) || null);
}

export async function saveAIResult(cache_key: string, task_type: string, output_json: Record<string, unknown>) {
  const input_hash = hashInput(output_json);
  return withMutableState((state) => {
    const existing = state.ai_cache.find((entry) => entry.cache_key === cache_key);
    const row: AiCacheEntry = {
      id: existing?.id || createId(),
      cache_key,
      input_hash,
      task_type,
      output_json,
      created_at: existing?.created_at || nowIso(),
    };

    if (existing) {
      Object.assign(existing, row);
    } else {
      state.ai_cache.push(row);
    }

    return row;
  });
}

function fallbackClusterSummary(cluster: RiskCluster, reports: Report[], signals: PublicSignal[]) {
  const support = [];
  if (reports.length) support.push(`${reports.length} citizen report${reports.length === 1 ? "" : "s"}`);
  if (signals.length) support.push(`${signals.length} public signal${signals.length === 1 ? "" : "s"}`);

  return {
    category: cluster.category,
    riskReason: `Evidence suggests a ${cluster.category.replace(/_/g, " ")} situation with ${support.join(" and ")}.`,
    confidenceReason:
      support.length > 1
        ? "Confidence is higher because both citizen and public-source evidence are present."
        : "Confidence is still developing because evidence is limited.",
    recommendedAction:
      cluster.risk_level === "urgent"
        ? "Prioritize fast verification and check official local sources."
        : "Monitor for more updates and route to the right responder.",
    extractedLocationText: cluster.title,
    moderationFlags: [],
  };
}

async function callOpenAI(task_type: string, input: Record<string, unknown>) {
  if (!hasOpenAIConfig()) return null;
  const cache_key = `${task_type}:${hashInput(input)}`;
  const cached = await getCachedAIResult(cache_key);
  if (cached) return cached.output_json;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are a civic risk analysis assistant. Focus on places, hazards, and evidence. Never accuse individuals. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      output_text?: string;
    };
    if (!payload.output_text) return null;
    const parsed = JSON.parse(payload.output_text) as Record<string, unknown>;
    await saveAIResult(cache_key, task_type, parsed);
    return parsed;
  } catch {
    return null;
  }
}

const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are a civic hazard image analyst for CivicSignal, a public safety reporting platform.

A citizen has uploaded a photo alongside a hazard report. Analyze the image thoroughly and return a structured JSON object — nothing else, no prose outside it.

Evaluate the image across these dimensions:
1. Does it visually confirm a civic hazard (road damage, flooding, fire/smoke, structural damage, unsafe conditions, obstruction, environmental hazard, crowd safety issue, etc.)?
2. How dangerous is the situation shown — assign a danger_score from 1 to 100 where 1 = no visible danger, 50 = moderate hazard with limited impact, 100 = immediate life-threatening danger to the public.
3. List every specific visual factor that raises or lowers the danger score (damage extent, affected area, people present, blocked access, time of day indicators, scale cues, etc.).
4. Write a detailed danger_reasoning paragraph explaining your score — include what you see, what risks it poses, who is affected, and what would change the score.
5. Estimated severity category: low / watch / serious / urgent.
6. Whether the image appears authentic or possibly edited.
7. Whether any PII is visible (faces, license plates, addresses, names).

Return ONLY this JSON:

{
  "confirms_hazard": true | false,
  "severity_estimate": "low" | "watch" | "serious" | "urgent",
  "danger_score": <integer 1–100>,
  "danger_reasoning": "<detailed paragraph: what is visible, what risks it poses, who is affected, what raises or lowers the score>",
  "danger_factors": ["<factor 1>", "<factor 2>", "<factor 3 — list every visual element that influenced the score>"],
  "evidence_score": <integer 0–100>,
  "score_reasoning": "<1-2 sentences on how strongly the image confirms the reported hazard>",
  "details_observed": "<1-2 sentences: objective description of what is visible>",
  "authenticity_flag": "likely_authentic" | "possibly_edited" | "unclear",
  "pii_detected": true | false,
  "pii_types": [],
  "recommended_action": "<one sentence: approve, flag for review, or reject and why>"
}

Danger score guidance:
- 1–15: No hazard visible or entirely benign scene
- 16–30: Minor issue, unlikely to cause harm without intervention
- 31–50: Moderate hazard, risk to property or minor injury possible
- 51–70: Serious hazard, significant risk to public safety
- 71–85: Severe hazard, likely injury or major disruption if unaddressed
- 86–100: Immediate life-threatening danger, emergency response warranted

Evidence score guidance:
- 0–20: Image does not show a civic hazard
- 21–40: Ambiguous — something present but unclear
- 41–60: Plausible but missing context (scale, angle, timing)
- 61–80: Hazard clearly visible with supporting detail
- 81–100: Unambiguous confirmation with full context

If no hazard is visible: confirms_hazard=false, severity_estimate="low", danger_score=1, evidence_score=0.
Keep all text factual and location-neutral. Never identify private individuals.`;


const IMAGE_ANALYSIS_FALLBACK: ImageAnalysisResult = {
  confirms_hazard: false,
  severity_estimate: "low",
  danger_score: 0,
  danger_reasoning: "Image analysis unavailable — Groq API key not configured.",
  danger_factors: [],
  evidence_score: 0,
  score_reasoning: "Image analysis unavailable — Groq API key not configured.",
  details_observed: "Could not analyze image.",
  authenticity_flag: "unclear",
  pii_detected: false,
  pii_types: [],
  recommended_action: "Review manually before publishing.",
};

export async function analyzeReportImage(imageBytes: ArrayBuffer, mimeType: string): Promise<ImageAnalysisResult> {
  if (!hasGroqConfig()) return IMAGE_ANALYSIS_FALLBACK;

  const cache_key = `analyze_report_image:${createHash("sha256").update(Buffer.from(imageBytes)).digest("hex")}`;
  const cached = await getCachedAIResult(cache_key);
  if (cached) return cached.output_json as unknown as ImageAnalysisResult;

  const base64 = Buffer.from(imageBytes).toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          { role: "system", content: IMAGE_ANALYSIS_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUrl } },
              { type: "text", text: "Analyze this image thoroughly and return the JSON object." },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!response.ok) return IMAGE_ANALYSIS_FALLBACK;

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return IMAGE_ANALYSIS_FALLBACK;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return IMAGE_ANALYSIS_FALLBACK;

    const parsed = JSON.parse(jsonMatch[0]) as ImageAnalysisResult;
    await saveAIResult(cache_key, "analyze_report_image", parsed as unknown as Record<string, unknown>);
    return parsed;
  } catch {
    return IMAGE_ANALYSIS_FALLBACK;
  }
}

export async function analyzeReportText(report: Pick<Report, "title" | "description" | "category" | "address_text">) {
  const fallback = {
    category: report.category,
    riskReason: `The report describes ${report.category.replace(/_/g, " ")} and includes direct observation details.`,
    confidenceReason: report.address_text
      ? "Confidence is higher because a location was provided."
      : "Confidence is limited because the location still needs verification.",
    recommendedAction: "Compare with nearby reports and ask for confirmation if the issue persists.",
    extractedLocationText: report.address_text || "",
    moderationFlags: [],
  };

  return (await callOpenAI("analyze_report_text", report)) || fallback;
}


export async function classifyPublicSignal(signal: Pick<PublicSignal, "title" | "text" | "category" | "source_name">) {
  const fallback = {
    category: signal.category,
    riskReason: `The public signal appears related to ${signal.category.replace(/_/g, " ")}.`,
    confidenceReason: `Confidence depends on the trust level of ${signal.source_name}.`,
    recommendedAction: "Use this as supporting evidence, not a final claim.",
    extractedLocationText: "",
    moderationFlags: [],
  };

  return (await callOpenAI("classify_public_signal", signal)) || fallback;
}

export async function summarizeRiskCluster(cluster: RiskCluster, reports: Report[], signals: PublicSignal[]) {
  return (await callOpenAI("summarize_risk_cluster", { cluster, reports, signals })) || fallbackClusterSummary(cluster, reports, signals);
}

export async function generateActionPlan(cluster: RiskCluster, reports: Report[], signals: PublicSignal[]) {
  const fallback = fallbackClusterSummary(cluster, reports, signals).recommendedAction;
  const result = await callOpenAI("generate_action_plan", { cluster, reports, signals });
  return typeof result?.recommendedAction === "string" ? result.recommendedAction : fallback;
}
