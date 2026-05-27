import { runAiRetriageJob } from "@/workers/ai-retriage";
import { runClusterDecayJob } from "@/workers/cluster-decay";
import { runFeedScanJob } from "@/workers/feed-scan";
import { runZoneRecomputeJob } from "@/workers/zone-recompute";

export const SCHEDULER_TASKS = ["feed-scan", "cluster-decay", "zone-recompute", "ai-retriage"] as const;

export type SchedulerTaskName = (typeof SCHEDULER_TASKS)[number];

type SchedulerJob = {
  task: SchedulerTaskName;
  run: (input?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const registry: Record<SchedulerTaskName, SchedulerJob> = {
  "feed-scan": {
    task: "feed-scan",
    run(input) {
      return runFeedScanJob({ feed_id: typeof input?.feed_id === "string" ? input.feed_id : undefined });
    },
  },
  "cluster-decay": {
    task: "cluster-decay",
    run(input) {
      return runClusterDecayJob({
        now: typeof input?.now === "string" ? input.now : undefined,
      });
    },
  },
  "zone-recompute": {
    task: "zone-recompute",
    run() {
      return runZoneRecomputeJob();
    },
  },
  "ai-retriage": {
    task: "ai-retriage",
    run(input) {
      return runAiRetriageJob({
        stale_hours: typeof input?.stale_hours === "number" ? input.stale_hours : undefined,
      });
    },
  },
};

export function getSchedulerJob(task: string) {
  if (!(task in registry)) return null;
  return registry[task as SchedulerTaskName];
}
