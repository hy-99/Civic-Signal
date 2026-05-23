import { withMutableState } from "@/lib/data-store";
import type { SystemAnalytics, UserAnalytics } from "@/lib/types";

export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  return withMutableState((state) => {
    const reports = state.reports.filter((report) => report.user_id === userId);
    return {
      total_reports: reports.length,
      active_reports: reports.filter((report) => report.status === "active").length,
      resolved_reports: reports.filter((report) => report.status === "resolved").length,
      verified_reports: reports.filter((report) => report.status === "verified").length,
      under_review_reports: reports.filter((report) => report.status === "needs_review").length,
    };
  });
}

export async function getSystemAnalytics(): Promise<SystemAnalytics> {
  return withMutableState((state) => {
    const resolved = state.reports.filter((report) => report.status === "resolved");
    const falseAlarms = state.reports.filter((report) => report.status === "false_alarm");
    const categoryCounts = state.reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.category] = (acc[report.category] || 0) + 1;
      return acc;
    }, {});
    const clusterCounts = state.risk_clusters.reduce<Record<string, number>>(
      (acc, cluster) => {
        acc[cluster.risk_level] = (acc[cluster.risk_level] || 0) + 1;
        return acc;
      },
      { low: 0, watch: 0, serious: 0, urgent: 0 },
    );

    const mostActiveAreas = state.risk_clusters
      .slice()
      .sort((a, b) => b.report_count + b.signal_count - (a.report_count + a.signal_count))
      .slice(0, 5)
      .map((cluster) => ({
        label: cluster.title,
        count: cluster.report_count + cluster.signal_count,
      }));

    const avgResolutionHours = resolved.length
      ? resolved.reduce((sum, report) => {
          return sum + (new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) / 3_600_000;
        }, 0) / resolved.length
      : 0;

    return {
      total_reports: state.reports.length,
      active_reports: state.reports.filter((report) => ["active", "verified", "in_progress", "needs_review"].includes(report.status)).length,
      resolved_reports: resolved.length,
      false_alarm_rate: state.reports.length ? Number(((falseAlarms.length / state.reports.length) * 100).toFixed(1)) : 0,
      average_resolution_time_hours: Number(avgResolutionHours.toFixed(1)),
      reports_by_category: categoryCounts,
      risk_clusters_by_level: clusterCounts as SystemAnalytics["risk_clusters_by_level"],
      public_signals_ingested: state.public_signals.length,
      moderation_queue_size: state.reports.filter((report) => report.status === "needs_review").length,
      source_feed_health: {
        healthy: state.source_feeds.filter((feed) => !feed.last_error).length,
        failing: state.source_feeds.filter((feed) => Boolean(feed.last_error)).length,
      },
      image_storage_estimate_mb: Number(((state.reports.filter((report) => report.image_storage_path).length * 0.45)).toFixed(1)),
      ai_calls_estimate: state.ai_cache.length,
      most_active_areas: mostActiveAreas,
    };
  });
}

export async function getLocalTrends(params?: { city?: string | null }) {
  const analytics = await getSystemAnalytics();
  return {
    city: params?.city || null,
    top_categories: Object.entries(analytics.reports_by_category)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    high_risk_clusters: analytics.most_active_areas,
  };
}
