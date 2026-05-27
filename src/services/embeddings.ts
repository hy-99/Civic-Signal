import { createHash } from "node:crypto";

import type { PublicSignal, Report } from "@/lib/types";
import { getCachedAIResult, generateEmbedding, saveAIResult } from "@/services/ai";

export const EMBEDDING_DIMENSIONS = 768;
const MAX_EMBEDDING_TEXT_CHARS = 2048;

function hashText(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeEmbeddingText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EMBEDDING_TEXT_CHARS);
}

export function buildReportEmbeddingText(report: Pick<Report, "title" | "description" | "category">) {
  return normalizeEmbeddingText(`${report.title} | ${report.description} | category=${report.category}`);
}

export function buildSignalEmbeddingText(signal: Pick<PublicSignal, "title" | "text" | "category">) {
  return normalizeEmbeddingText(`${signal.title} | ${signal.text || ""} | category=${signal.category}`);
}

function isEmbeddingPayload(value: unknown): value is { values: number[] } {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { values?: unknown[] }).values) &&
      (value as { values: unknown[] }).values.every((entry) => typeof entry === "number"),
  );
}

export async function getTextEmbedding(text: string) {
  const normalized = normalizeEmbeddingText(text);
  const cache_key = `embedding:${hashText(normalized)}`;
  const cached = await getCachedAIResult(cache_key);

  if (isEmbeddingPayload(cached?.output_json)) {
    return cached.output_json.values;
  }

  const values = await generateEmbedding(normalized);
  await saveAIResult(cache_key, "embedding", { values });
  return values;
}
