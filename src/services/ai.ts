import { createHash } from "node:crypto";

import { getEnv, hasGeminiConfig } from "@/lib/env";
import { withMutableState } from "@/lib/data-store";
import type { AiCacheEntry, ImageAnalysisResult, PublicSignal, Report, RiskCluster } from "@/lib/types";
import { normalizeVector } from "@/lib/vector";
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

function extractGeminiText(payload: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }) {
  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

const TOKEN_ALIASES: Record<string, string> = {
  fallen: "down",
  downed: "down",
  huge: "large",
  big: "large",
  branch: "tree",
  branches: "tree",
  limb: "tree",
  limbs: "tree",
  oak: "tree",
  pine: "tree",
  street: "street",
  st: "street",
  road: "street",
  rd: "street",
  avenue: "street",
  ave: "street",
  blocking: "block",
  blocked: "block",
  blockage: "block",
  closure: "block",
  closed: "block",
  lane: "street",
  lanes: "street",
  smoke: "fire",
  wildfire: "fire",
  flood: "flooding",
  flooded: "flooding",
  winds: "storm",
  wind: "storm",
  gusts: "storm",
  obstruction: "block",
  obstructed: "block",
};

const EMBEDDING_DIMENSIONS = 768;
const STOP_WORDS = new Set(["a", "an", "the", "is", "are", "on", "in", "at", "to", "for", "of", "and", "after", "near", "across"]);
const FEATURE_WEIGHTS: Record<string, number> = {
  tree: 2.4,
  block: 2.2,
  street: 1.5,
  main: 1.2,
  main_street: 2.8,
  down: 1.8,
  storm: 1.5,
  flooding: 2.4,
  fire: 2.4,
};
const SEMANTIC_CONCEPTS = [
  "tree",
  "block",
  "street",
  "main",
  "main_street",
  "down",
  "storm",
  "flooding",
  "fire",
  "power",
  "crowd",
  "school",
  "weather",
] as const;

function hashString(value: string) {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0);
}

function tokenizeEmbeddingText(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/main st\b/g, "main street")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => TOKEN_ALIASES[token] || token);

  const meaningfulTokens = tokens.filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const features = [...meaningfulTokens];
  for (let index = 0; index < meaningfulTokens.length - 1; index += 1) {
    features.push(`${meaningfulTokens[index]}_${meaningfulTokens[index + 1]}`);
  }

  return features;
}

function buildFallbackEmbedding(text: string) {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  const features = tokenizeEmbeddingText(text);

  if (!features.length) return vector;

  for (const feature of features) {
    const conceptIndex = SEMANTIC_CONCEPTS.indexOf(feature as (typeof SEMANTIC_CONCEPTS)[number]);
    if (conceptIndex >= 0) {
      vector[conceptIndex] += FEATURE_WEIGHTS[feature] || 1.5;
    }
  }

  for (const [index, feature] of features.entries()) {
    const seed = hashString(`${feature}:${index}`);
    const primary = seed % EMBEDDING_DIMENSIONS;
    const secondary = (seed >>> 11) % EMBEDDING_DIMENSIONS;
    const weight = FEATURE_WEIGHTS[feature] || (feature.includes("_") ? 1.6 : 1);

    vector[primary] += weight;
    vector[secondary] += weight * 0.35;
  }

  return normalizeVector(vector);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);

  const env = getEnv();
  if (!env.gemini_api_key) {
    return buildFallbackEmbedding(normalized);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini_embedding_model)}:embedContent?key=${encodeURIComponent(env.gemini_api_key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: {
            parts: [{ text: normalized }],
          },
          taskType: "CLUSTERING",
        }),
      },
    );

    if (!response.ok) return buildFallbackEmbedding(normalized);
    const payload = (await response.json()) as { embedding?: { values?: number[] } };
    const values = payload.embedding?.values;
    if (!Array.isArray(values) || !values.every((value) => typeof value === "number")) {
      return buildFallbackEmbedding(normalized);
    }
    return normalizeVector(values);
  } catch {
    return buildFallbackEmbedding(normalized);
  }
}

export async function runGeminiJsonTask(task_type: string, input: Record<string, unknown>, systemInstruction: string) {
  if (!hasGeminiConfig()) return null;
  const cache_key = `${task_type}:${hashInput(input)}`;
  const cached = await getCachedAIResult(cache_key);
  if (cached) return cached.output_json;

  const env = getEnv();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini_model)}:generateContent?key=${encodeURIComponent(env.gemini_api_key)}`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(input) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    },
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = extractGeminiText(payload);
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text) as Record<string, unknown>;
    await saveAIResult(cache_key, task_type, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export interface ReportClaim {
  title: string;
  description: string;
  category_label: string;
}

const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are a civic hazard image analyst for CivicSignal, a public safety reporting platform.

A citizen has uploaded a photo alongside a hazard report. The user also provided a title, description, and category that describe what they claim the image shows. Analyze the image thoroughly, compare it against the user's claim, and return a structured JSON object — nothing else, no prose outside it.

Evaluate the image across these dimensions:
1. Does it visually confirm a civic hazard (road damage, flooding, fire/smoke, structural damage, unsafe conditions, obstruction, environmental hazard, crowd safety issue, etc.)?
2. How dangerous is the situation shown — assign a danger_score from 1 to 100 where 1 = no visible danger, 50 = moderate hazard with limited impact, 100 = immediate life-threatening danger to the public.
3. List every specific visual factor that raises or lowers the danger score (damage extent, affected area, people present, blocked access, time of day indicators, scale cues, etc.).
4. Write a detailed danger_reasoning paragraph explaining your score — include what you see, what risks it poses, who is affected, and what would change the score.
5. Estimated severity category: low / watch / serious / urgent.
6. Whether the image appears authentic or possibly edited.
7. Whether any PII is visible (faces, license plates, addresses, names).
8. Whether the image is consistent with the user's title/description/category. If the user described a fire but the image is a houseplant, that is a mismatch. If the user described a pothole but the image is a fallen tree, that is also a mismatch — even though both are hazards. Set matches_claim accordingly and write a one-sentence claim_mismatch_reason whenever matches_claim is false.

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
  "recommended_action": "<one sentence: approve, flag for review, or reject and why>",
  "matches_claim": true | false,
  "claim_mismatch_reason": "<empty string if matches_claim is true, otherwise one sentence explaining how the image differs from the user's title/description/category>",
  "suggested_title": "<empty string if matches_claim is true; otherwise a short 4-80 character title that accurately describes the hazard actually visible in the image>",
  "suggested_category": "<empty string if matches_claim is true; otherwise the single best CivicSignal category key for what the image actually shows. Choose exactly one of: road_hazard, pothole, traffic_obstruction, flooding, fire_smoke, power_outage, broken_streetlight, trash_sanitation, unsafe_sidewalk, fallen_tree, building_structure_concern, public_event_crowding, school_area_concern, public_disturbance, unauthorized_vending, crowd_safety, weather_damage, other>"
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

If no hazard is visible: confirms_hazard=false, severity_estimate="low", danger_score=1, evidence_score=0, matches_claim=false (because no civic hazard is shown), and claim_mismatch_reason should explain what the image actually depicts.
If the image shows a hazard that is a different category from the user's claim, set matches_claim=false even though confirms_hazard=true.
Keep all text factual and location-neutral. Never identify private individuals.`;


const IMAGE_ANALYSIS_FALLBACK: ImageAnalysisResult = {
  confirms_hazard: false,
  severity_estimate: "low",
  danger_score: 0,
  danger_reasoning: "Image analysis unavailable — Gemini API key not configured.",
  danger_factors: [],
  evidence_score: 0,
  score_reasoning: "Image analysis unavailable — Gemini API key not configured.",
  details_observed: "Could not analyze image.",
  authenticity_flag: "unclear",
  pii_detected: false,
  pii_types: [],
  recommended_action: "Review manually before publishing.",
  matches_claim: true,
  claim_mismatch_reason: "",
};

function buildClaimUserMessage(claim: ReportClaim | null) {
  if (!claim) {
    return "Analyze this image thoroughly and return the JSON object. No user claim was provided, so set matches_claim to true and claim_mismatch_reason to an empty string.";
  }
  const lines = [
    "The user submitted this image with the following claim. Decide whether the image is consistent with it.",
    `Category: ${claim.category_label}`,
    `Title: ${claim.title}`,
    `Description: ${claim.description}`,
    "Analyze the image thoroughly, judge whether it matches the claim above, and return the JSON object.",
  ];
  return lines.join("\n");
}

export async function analyzeReportImage(
  imageBytes: ArrayBuffer,
  mimeType: string,
  claim: ReportClaim | null = null,
): Promise<ImageAnalysisResult> {
  if (!hasGeminiConfig()) return IMAGE_ANALYSIS_FALLBACK;

  const env = getEnv();
  const imageHash = createHash("sha256").update(Buffer.from(imageBytes)).digest("hex");
  const claimHash = claim ? createHash("sha256").update(JSON.stringify(claim)).digest("hex") : "no_claim";
  const cache_key = `analyze_report_image:${imageHash}:${claimHash}`;
  const cached = await getCachedAIResult(cache_key);
  if (cached) return cached.output_json as unknown as ImageAnalysisResult;

  const base64 = Buffer.from(imageBytes).toString("base64");
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini_vision_model)}:generateContent?key=${encodeURIComponent(env.gemini_api_key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: IMAGE_ANALYSIS_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64,
                  },
                },
                { text: buildClaimUserMessage(claim) },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 1400,
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) return IMAGE_ANALYSIS_FALLBACK;

    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = extractGeminiText(payload);
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

export interface ClaimImageConsistencyVerdict {
  matches: boolean;
  reason: string;
  suggested_title?: string;
  suggested_category?: string;
}

const CLAIM_CONSISTENCY_SYSTEM_PROMPT = `You are a civic-report consistency checker. A user submitted a hazard report (title, description, category) and a separate AI described what their attached image actually shows. Decide whether the image content is consistent with the user's claim.

Return ONLY this JSON, nothing else:
{
  "matches": true | false,
  "reason": "<one short sentence; if matches is false, say exactly what the image shows that doesn't fit the claim>",
  "suggested_title": "<empty string if matches is true; otherwise a short 4-80 character title describing the hazard actually visible in the image>",
  "suggested_category": "<empty string if matches is true; otherwise one of: road_hazard, pothole, traffic_obstruction, flooding, fire_smoke, power_outage, broken_streetlight, trash_sanitation, unsafe_sidewalk, fallen_tree, building_structure_concern, public_event_crowding, school_area_concern, public_disturbance, unauthorized_vending, crowd_safety, weather_damage, other>"
}

Rules:
- "matches" is false if the image depicts something the user did not claim (e.g., user claimed a fire but image shows a houseplant, or user claimed a pothole but image shows a fallen tree).
- "matches" is true only when the image clearly depicts the same category of hazard described by the user.
- If the image is ambiguous or generic, prefer matches=false and explain why.
- When suggesting a title and category, base them on what the image actually depicts, not the user's claim.`;

export async function checkClaimImageConsistency(
  claim: { title: string; description: string; category_label: string },
  detailsObserved: string,
): Promise<ClaimImageConsistencyVerdict | null> {
  if (!hasGeminiConfig()) return null;
  const input = { claim, details_observed: detailsObserved };
  const cache_key = `check_claim_image_consistency:${hashInput(input)}`;
  const cached = await getCachedAIResult(cache_key);
  if (cached) return cached.output_json as unknown as ClaimImageConsistencyVerdict;

  const env = getEnv();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.gemini_model)}:generateContent?key=${encodeURIComponent(env.gemini_api_key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: CLAIM_CONSISTENCY_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    `Category: ${claim.category_label}`,
                    `Title: ${claim.title}`,
                    `Description: ${claim.description}`,
                    `Image shows: ${detailsObserved}`,
                    "Return the JSON verdict.",
                  ].join("\n"),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 320,
            temperature: 0,
          },
        }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = extractGeminiText(payload);
    if (!content) return null;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as ClaimImageConsistencyVerdict;
    await saveAIResult(cache_key, "check_claim_image_consistency", parsed as unknown as Record<string, unknown>);
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

  return (
    await runGeminiJsonTask(
      "analyze_report_text",
      report,
      "You are a civic risk analysis assistant. Focus on places, hazards, and evidence. Never accuse individuals. Return JSON only.",
    )
  ) || fallback;
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

  return (
    await runGeminiJsonTask(
      "classify_public_signal",
      signal,
      "You classify public civic signals. Focus on public conditions and place-based hazards. Return JSON only.",
    )
  ) || fallback;
}

export async function summarizeRiskCluster(cluster: RiskCluster, reports: Report[], signals: PublicSignal[]) {
  return (
    await runGeminiJsonTask(
      "summarize_risk_cluster",
      { cluster, reports, signals },
      "Summarize a civic risk cluster without accusing private people. Return JSON only.",
    )
  ) || fallbackClusterSummary(cluster, reports, signals);
}

export async function generateActionPlan(cluster: RiskCluster, reports: Report[], signals: PublicSignal[]) {
  const fallback = fallbackClusterSummary(cluster, reports, signals).recommendedAction;
  const result = await runGeminiJsonTask(
    "generate_action_plan",
    { cluster, reports, signals },
    "Create a concise operational action plan for a civic incident. Return JSON only.",
  );
  return typeof result?.recommendedAction === "string" ? result.recommendedAction : fallback;
}
