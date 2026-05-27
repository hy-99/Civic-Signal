import { loadState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import { buildSignalLifecycleEvents } from "@/lib/events/domain";
import type { MapFilters, PublicSignal, PublicSignalView, SourceFeed } from "@/lib/types";
import { buildSignalEmbeddingText, getTextEmbedding } from "@/services/embeddings";
import { classifyPublicSignal } from "@/services/ai";
import { linkSignalToClusterInState, recalculateClusterInState } from "@/services/clusters";
import { geocodeAddress } from "@/services/geocoding";
import { scoreSignal } from "@/services/scoring";
import { createId, nowIso } from "@/lib/utils";

function buildSignalView(state: Awaited<ReturnType<typeof loadState>>, signal: PublicSignal): PublicSignalView {
  return {
    ...signal,
    confidence_label: signal.analysis_json.score_breakdown.confidence_label,
    risk_level: signal.analysis_json.score_breakdown.risk_level,
    cluster: signal.cluster_id ? state.risk_clusters.find((item) => item.id === signal.cluster_id) || null : null,
  };
}

function trustedSource(feed: SourceFeed | null, signal: PublicSignal) {
  if (feed && feed.trust_level >= 70) return true;
  return ["city_alert", "weather", "traffic", "usgs", "nws", "open_meteo"].includes(signal.source_type);
}

export async function createPublicSignal(
  input: Pick<PublicSignal, "title" | "text" | "source_name" | "source_type" | "source_url" | "category" | "address_text" | "external_id"> & {
    source_feed_id?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    published_at?: string | null;
  },
) {
  let latitude = input.latitude ?? null;
  let longitude = input.longitude ?? null;
  if ((latitude === null || longitude === null) && input.address_text) {
    const geocoded = await geocodeAddress(input.address_text);
    latitude = geocoded.latitude;
    longitude = geocoded.longitude;
  }

  const aiPreview = await classifyPublicSignal({
    title: input.title,
    text: input.text || null,
    category: input.category,
    source_name: input.source_name,
  });
  const embedding = await getTextEmbedding(
    buildSignalEmbeddingText({
      title: input.title,
      text: input.text || null,
      category: input.category,
    }),
  );

  return withMutableState(async (state) => {
    if (input.external_id && input.source_feed_id) {
      const existing = state.public_signals.find(
        (item) => item.source_feed_id === input.source_feed_id && item.external_id === input.external_id,
      );
      if (existing) {
        return buildSignalView(state, existing);
      }
    }

    const signal: PublicSignal = {
      id: createId(),
      source_feed_id: input.source_feed_id || null,
      source_name: input.source_name,
      source_type: input.source_type,
      source_url: input.source_url || null,
      external_id: input.external_id ?? null,
      title: input.title,
      text: input.text || null,
      category: input.category,
      status: "unmatched",
      latitude,
      longitude,
      address_text: input.address_text || null,
      published_at: input.published_at || nowIso(),
      risk_score: 0,
      confidence_score: 0,
      embedding,
      analysis_summary: null,
      analysis_json: {
        score_breakdown: {
          risk_score: 0,
          confidence_score: 0,
          risk_level: "low",
          confidence_label: "very_low",
          risk_factors: [],
          confidence_factors: [],
          risk_reason: "",
          confidence_reason: "",
          recommended_action: "",
        },
        moderation_flags: [],
      },
      cluster_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const feed = signal.source_feed_id ? state.source_feeds.find((item) => item.id === signal.source_feed_id) || null : null;
    const score = scoreSignal(signal, {
      trusted_source: trustedSource(feed, signal),
      matched_cluster: false,
    });
    signal.risk_score = score.risk_score;
    signal.confidence_score = score.confidence_score;
    signal.analysis_summary = score.risk_reason;
    signal.analysis_json = {
      score_breakdown: score,
      moderation_flags: [],
      extracted_location_text: typeof aiPreview.extractedLocationText === "string" ? aiPreview.extractedLocationText : null,
      source_confidence: feed?.trust_level || (trustedSource(feed, signal) ? 80 : 50),
    };
    signal.status = signal.confidence_score < 35 ? "needs_review" : "unmatched";

    state.public_signals.push(signal);
    await linkSignalToClusterInState(state, signal);
    if (signal.cluster_id) {
      signal.status = "matched";
      await recalculateClusterInState(state, signal.cluster_id);
    }
    for (const event of buildSignalLifecycleEvents(signal)) {
      bus.emit(event);
    }
    return buildSignalView(state, signal);
  });
}

export async function getPublicSignals(params?: MapFilters & { include_hidden?: boolean }) {
  const state = await loadState();
  let items = state.public_signals.filter((signal) =>
    params?.include_hidden ? true : ["matched", "unmatched", "needs_review"].includes(signal.status),
  );

  if (params?.category && params.category !== "all") items = items.filter((signal) => signal.category === params.category);
  if (params?.source_type && params.source_type !== "all") items = items.filter((signal) => signal.source_type === params.source_type);
  if (params?.query) items = items.filter((signal) => `${signal.title} ${signal.text || ""}`.toLowerCase().includes(params.query!.toLowerCase()));

  items = items.sort((a, b) => {
    if (params?.sort === "recent") return +new Date(b.published_at || b.created_at) - +new Date(a.published_at || a.created_at);
    return b.risk_score - a.risk_score || b.confidence_score - a.confidence_score;
  });

  return items.map((signal) => buildSignalView(state, signal));
}

export async function analyzeSignal(signal_id: string) {
  return withMutableState(async (state) => {
    const signal = state.public_signals.find((item) => item.id === signal_id);
    if (!signal) throw new Error("Signal not found.");
    const feed = signal.source_feed_id ? state.source_feeds.find((item) => item.id === signal.source_feed_id) || null : null;
    const score = scoreSignal(signal, {
      trusted_source: trustedSource(feed, signal),
      matched_cluster: Boolean(signal.cluster_id),
    });
    signal.risk_score = score.risk_score;
    signal.confidence_score = score.confidence_score;
    signal.analysis_summary = score.risk_reason;
    signal.analysis_json.score_breakdown = score;
    signal.updated_at = nowIso();
    if (signal.cluster_id) await recalculateClusterInState(state, signal.cluster_id);
    return buildSignalView(state, signal);
  });
}

export async function matchSignalToCluster(signal_id: string) {
  return withMutableState(async (state) => {
    const signal = state.public_signals.find((item) => item.id === signal_id);
    if (!signal) throw new Error("Signal not found.");
    await linkSignalToClusterInState(state, signal);
    if (signal.cluster_id) {
      signal.status = "matched";
      await recalculateClusterInState(state, signal.cluster_id);
    }
    return buildSignalView(state, signal);
  });
}

export async function ignoreSignal(signal_id: string) {
  return withMutableState((state) => {
    const signal = state.public_signals.find((item) => item.id === signal_id);
    if (!signal) throw new Error("Signal not found.");
    signal.status = "ignored";
    signal.updated_at = nowIso();
    return buildSignalView(state, signal);
  });
}

export async function approveSignal(signal_id: string) {
  return withMutableState(async (state) => {
    const signal = state.public_signals.find((item) => item.id === signal_id);
    if (!signal) throw new Error("Signal not found.");
    signal.status = "matched";
    if (signal.cluster_id) await recalculateClusterInState(state, signal.cluster_id);
    signal.updated_at = nowIso();
    return buildSignalView(state, signal);
  });
}
