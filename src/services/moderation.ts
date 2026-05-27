import { withMutableState } from "@/lib/data-store";
import type { ModerationAction, ModerationFlag, Profile, Report, ReviewQueueItem } from "@/lib/types";
import { applyClusterStatusToReportsInState } from "@/services/clusters";
import { createIncidentCaseFromClusterInState, createIncidentCaseFromReportInState } from "@/services/cases";
import { createId, nowIso } from "@/lib/utils";

const sensitivePublicSpaceCategories = new Set<Report["category"]>([
  "school_area_concern",
  "public_disturbance",
  "unauthorized_vending",
]);

export function checkTextForSensitiveContent(text: string) {
  const flags: ModerationFlag[] = [];
  const lowered = text.toLowerCase();

  if (/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text) && /(dangerous|criminal|attacked|caused|selling|dealing|fighting|harassing|threatened|assaulted)/i.test(text)) {
    flags.push("personal_accusation");
  }
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text) || /\b\S+@\S+\.\S+\b/.test(text)) {
    flags.push("private_information");
  }
  if (/(hate|idiot|kill|threaten)/i.test(text)) {
    flags.push("harassment");
  }
  if (/buy now|click here|free money|crypto giveaway/i.test(text)) {
    flags.push("possible_spam");
  }
  if (/(definitely|certainly) (fire|flood|attack|fight|selling|dealing)/i.test(lowered)) {
    flags.push("unsafe_claim");
  }

  return [...new Set(flags)];
}

export function checkReportForModeration(report: Pick<Report, "title" | "description" | "urgency" | "category" | "image_url">) {
  const textFlags = checkTextForSensitiveContent(`${report.title}\n${report.description}`);
  const flags = [...textFlags];
  const lowered = `${report.title}\n${report.description}`.toLowerCase();

  if (report.urgency === "urgent" && report.description.trim().length < 30) flags.push("vague_urgent_report");
  if (report.category === "other" && report.urgency === "urgent") flags.push("vague_urgent_report");
  if (sensitivePublicSpaceCategories.has(report.category) && /(drug dealer|vape dealer|gang|criminal|weapon|gun|knife|definitely selling|definitely fighting)/i.test(lowered)) {
    flags.push("unsafe_claim");
  }
  if (report.image_url) flags.push("image_review_needed");

  const moderation_flag = flags[0] || null;
  const needs_review = Boolean(flags.length);
  return {
    needs_review,
    moderation_flag,
    moderation_flags: [...new Set(flags)],
  };
}

export async function createModerationAction(input: Omit<ModerationAction, "id" | "created_at">) {
  return withMutableState((state) => {
    const action: ModerationAction = {
      ...input,
      id: createId(),
      created_at: nowIso(),
    };
    state.moderation_actions.push(action);
    return action;
  });
}

export async function getReviewQueue() {
  return withMutableState((state) => {
    const reportItems: ReviewQueueItem[] = state.reports
      .filter((report) => report.status === "needs_review" || Boolean(report.moderation_flag))
      .map((report) => {
        const profile = state.profiles.find((item) => item.id === report.user_id) || null;
        return {
          id: report.id,
          type: "report",
          title: report.title,
          description: report.description,
          image_url: report.image_url,
          location: report.address_text || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`,
          risk_score: report.risk_score,
          confidence_score: report.confidence_score,
          reason_for_review: report.moderation_flag || "Needs review",
          similar_items: state.reports
            .filter((candidate) => candidate.id !== report.id && candidate.category === report.category)
            .slice(0, 3)
            .map((candidate) => candidate.title),
          user_trust_score: profile?.trust_score ?? null,
          created_at: report.created_at,
        };
      });

    const signalItems: ReviewQueueItem[] = state.public_signals
      .filter((signal) => signal.status === "needs_review")
      .map((signal) => ({
        id: signal.id,
        type: "signal",
        title: signal.title,
        description: signal.text || signal.analysis_summary || "Public signal requires review.",
        image_url: null,
        location: signal.address_text || "Broad area signal",
        risk_score: signal.risk_score,
        confidence_score: signal.confidence_score,
        reason_for_review: signal.analysis_json.moderation_flags[0] || "Needs review",
        similar_items: state.risk_clusters
          .filter((cluster) => cluster.category === signal.category)
          .slice(0, 3)
          .map((cluster) => cluster.title),
        user_trust_score: null,
        created_at: signal.created_at,
      }));

    return [...reportItems, ...signalItems].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  });
}

export async function moderateItem(input: {
  actor: Profile;
  target_type: "report" | "cluster" | "signal";
  target_id: string;
  action: string;
  reason?: string | null;
}) {
  return withMutableState((state) => {
    if (input.target_type === "report") {
      const report = state.reports.find((item) => item.id === input.target_id);
      if (!report) throw new Error("Report not found.");

      if (input.action === "approve") {
        report.status = "active";
        report.moderation_flag = null;
      }
      if (input.action === "hide") report.status = "hidden";
      if (input.action === "mark_false_alarm") report.status = "false_alarm";
      if (input.action === "mark_resolved") report.status = "resolved";
      if (input.action === "mark_duplicate") report.status = "duplicate";
      if (input.action === "create_case") createIncidentCaseFromReportInState(state, report);
      report.updated_at = nowIso();
    }

    if (input.target_type === "signal") {
      const signal = state.public_signals.find((item) => item.id === input.target_id);
      if (!signal) throw new Error("Signal not found.");
      if (input.action === "approve") signal.status = "matched";
      if (input.action === "hide") signal.status = "hidden";
      if (input.action === "mark_false_alarm") signal.status = "ignored";
      if (input.action === "ignore") signal.status = "ignored";
      if (input.action === "needs_review") signal.status = "needs_review";
      signal.updated_at = nowIso();
    }

    if (input.target_type === "cluster") {
      const cluster = state.risk_clusters.find((item) => item.id === input.target_id);
      if (!cluster) throw new Error("Cluster not found.");
      if (input.action === "hide") cluster.status = "hidden";
      if (input.action === "mark_false_alarm") cluster.status = "false_alarm";
      if (input.action === "mark_resolved") cluster.status = "resolved";
      if (input.action === "mark_in_progress") cluster.status = "in_progress";
      if (input.action === "mark_verified") cluster.status = "verified";
      if (input.action === "mark_active") cluster.status = "active";
      if (input.action === "create_case") createIncidentCaseFromClusterInState(state, cluster);
      cluster.updated_at = nowIso();
      applyClusterStatusToReportsInState(state, cluster.id, cluster.status);
    }

    const action: ModerationAction = {
      id: createId(),
      actor_id: input.actor.id,
      target_type: input.target_type,
      target_id: input.target_id,
      action: input.action,
      reason: input.reason || null,
      metadata: {},
      created_at: nowIso(),
    };
    state.moderation_actions.push(action);
    return action;
  });
}
