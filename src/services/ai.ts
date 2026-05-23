import { createHash } from "node:crypto";

import { hasOpenAIConfig } from "@/lib/env";
import { withMutableState } from "@/lib/data-store";
import type { AiCacheEntry, PublicSignal, Report, RiskCluster } from "@/lib/types";
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
