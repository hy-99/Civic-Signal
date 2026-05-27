import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/cron/[task]/route";
import { createInitialState } from "@/lib/mock-data";
import { getSchedulerJob, SCHEDULER_TASKS } from "@/lib/scheduler/jobs";
import { createJobQueue } from "@/lib/scheduler/queue";
import { runSchedulerJob } from "@/lib/scheduler/runner";
import { withSerializedTest } from "@/tests/support/serialized";
import { applyClusterDecayInState } from "@/workers/cluster-decay";

test("job queue respects concurrency=1 and preserves enqueue order", async () => {
  const queue = createJobQueue({ concurrency: 1 });
  const steps: string[] = [];

  const first = queue.enqueue(async () => {
    steps.push("first:start");
    await new Promise((resolve) => setTimeout(resolve, 10));
    steps.push("first:end");
    return "first";
  });

  const second = queue.enqueue(async () => {
    steps.push("second:start");
    steps.push("second:end");
    return "second";
  });

  const results = await Promise.all([first, second]);

  assert.deepEqual(results, ["first", "second"]);
  assert.deepEqual(steps, ["first:start", "first:end", "second:start", "second:end"]);
});

test("scheduler registry exposes the supported task names", () => {
  assert.deepEqual(SCHEDULER_TASKS, ["feed-scan", "cluster-decay", "zone-recompute", "ai-retriage"]);
  assert.ok(getSchedulerJob("feed-scan"));
  assert.ok(getSchedulerJob("cluster-decay"));
  assert.equal(getSchedulerJob("missing-task"), null);
});

test("cluster decay reduces stale cluster score and resolves very old low-risk clusters", () => {
  const state = createInitialState();
  const staleCluster = state.risk_clusters[0];
  assert.ok(staleCluster);
  staleCluster.status = "active";
  staleCluster.risk_score = 12;
  staleCluster.last_activity_at = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const linkedReportIds = state.cluster_items.filter((item) => item.cluster_id === staleCluster.id && item.item_type === "report").map((item) => item.item_id);
  for (const report of state.reports) {
    if (linkedReportIds.includes(report.id)) {
      report.status = "active";
      report.updated_at = staleCluster.last_activity_at;
    }
  }

  const summary = applyClusterDecayInState(state, { now: new Date().toISOString() });

  assert.ok(summary.processed >= 1);
  assert.ok(summary.updated >= 1);
  assert.ok(summary.resolved >= 1);
  assert.ok(staleCluster.risk_score < 10);
  assert.equal(staleCluster.status, "resolved");
});

test("cron route returns 401 without matching credentials", async () => {
  await withSerializedTest(async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "scheduler-secret";

    try {
      const response = await POST(new Request("http://localhost:3000/api/cron/cluster-decay", { method: "POST" }), {
        params: Promise.resolve({ task: "cluster-decay" }),
      });

      assert.equal(response.status, 401);
    } finally {
      process.env.CRON_SECRET = previousSecret;
    }
  });
});

test("cron route dispatches an authorized job and returns summary metadata", async () => {
  await withSerializedTest(async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "scheduler-secret";

    try {
      const response = await POST(
        new Request("http://localhost:3000/api/cron/cluster-decay", {
          method: "POST",
          headers: { Authorization: "Bearer scheduler-secret" },
        }),
        {
          params: Promise.resolve({ task: "cluster-decay" }),
        },
      );

      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        ok: boolean;
        data: { task: string; started_at: string; finished_at: string; summary: Record<string, unknown> };
      };

      assert.equal(payload.ok, true);
      assert.equal(payload.data.task, "cluster-decay");
      assert.equal(typeof payload.data.started_at, "string");
      assert.equal(typeof payload.data.finished_at, "string");
      assert.equal(typeof payload.data.summary, "object");
    } finally {
      process.env.CRON_SECRET = previousSecret;
    }
  });
});

test("runner rejects unknown jobs", async () => {
  await assert.rejects(() => runSchedulerJob("missing-task"), /Unknown scheduler task/);
});
