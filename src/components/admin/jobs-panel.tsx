"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge, Button, Card } from "@/components/ui/primitives";

const JOBS = [
  {
    task: "feed-scan",
    label: "Run feed scan",
    description: "Scan all active source feeds with the current ingestion pipeline.",
  },
  {
    task: "cluster-decay",
    label: "Run cluster decay",
    description: "Decay stale cluster scores and auto-resolve very old low-risk clusters.",
  },
  {
    task: "zone-recompute",
    label: "Run zone recompute",
    description: "Refresh zone geometries from their linked cluster positions.",
  },
  {
    task: "ai-retriage",
    label: "Run AI re-triage",
    description: "Re-run case triage for stale active cases using the current rules and AI path.",
  },
] as const;

type JobTask = (typeof JOBS)[number]["task"];

function formatSummary(summary: Record<string, unknown>) {
  return Object.entries(summary)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(" · ");
}

export function JobsPanel() {
  const router = useRouter();
  const [results, setResults] = useState<Partial<Record<JobTask, string>>>({});
  const [runningTask, setRunningTask] = useState<JobTask | null>(null);
  const [isPending, startTransition] = useTransition();

  const runTask = (task: JobTask) => {
    setRunningTask(task);
    startTransition(async () => {
      const response = await fetch(`/api/cron/${task}`, { method: "POST" });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { summary?: Record<string, unknown> };
      };

      setResults((current) => ({
        ...current,
        [task]: payload.ok ? formatSummary(payload.data?.summary || {}) : payload.error || "Job failed.",
      }));
      setRunningTask(null);
      if (payload.ok) {
        window.setTimeout(() => router.refresh(), 450);
      }
    });
  };

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Scheduler</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Manual background jobs</h2>
          <p className="mt-1 text-sm text-slate-500">
            These actions hit the new cron route directly so the hackathon demo can run without a hosted scheduler.
          </p>
        </div>
        <Badge tone="accent">Admin only</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {JOBS.map((job) => (
          <div key={job.task} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-950">{job.label}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{job.description}</p>
            <div className="mt-3 flex items-center gap-3">
              <Button type="button" disabled={isPending} onClick={() => runTask(job.task)}>
                {runningTask === job.task ? "Running..." : job.label}
              </Button>
            </div>
            {results[job.task] ? <p className="mt-3 text-sm font-medium text-blue-700">{results[job.task]}</p> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
