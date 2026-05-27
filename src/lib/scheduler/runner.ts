import { createJobQueue } from "@/lib/scheduler/queue";
import { getSchedulerJob } from "@/lib/scheduler/jobs";
import { nowIso } from "@/lib/utils";

declare global {
  var __civicsignalSchedulerQueue: ReturnType<typeof createJobQueue> | undefined;
}

const schedulerQueue = globalThis.__civicsignalSchedulerQueue ?? (globalThis.__civicsignalSchedulerQueue = createJobQueue({ concurrency: 1 }));

export async function runSchedulerJob(task: string, input?: Record<string, unknown>) {
  const job = getSchedulerJob(task);
  if (!job) {
    throw new Error(`Unknown scheduler task: ${task}`);
  }

  const started_at = nowIso();
  const summary = await schedulerQueue.enqueue(() => job.run(input));
  const finished_at = nowIso();

  return {
    task: job.task,
    started_at,
    finished_at,
    summary,
  };
}
