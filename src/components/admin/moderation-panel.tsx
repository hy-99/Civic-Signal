"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui/primitives";

type ModerationTarget = "report" | "cluster" | "signal";

type Action = {
  action: string;
  label: string;
  tone: "primary" | "blue" | "warning" | "danger" | "ghost";
  description: string;
};

const CLUSTER_ACTIONS: Action[] = [
  {
    action: "mark_in_progress",
    label: "Mark in progress",
    tone: "blue",
    description: "Government is responding — pin gets a blue ring on the map.",
  },
  {
    action: "mark_verified",
    label: "Mark verified",
    tone: "warning",
    description: "Government has confirmed the hazard — pin gets a risk-based verification glow on the map.",
  },
  {
    action: "mark_resolved",
    label: "Mark resolved",
    tone: "primary",
    description: "Issue is fixed — cluster is removed from the public map.",
  },
  {
    action: "mark_false_alarm",
    label: "Mark false alarm",
    tone: "danger",
    description: "Not a real hazard — cluster is removed from the public map.",
  },
  {
    action: "mark_active",
    label: "Reset to active",
    tone: "ghost",
    description: "Clear any government tag and show the cluster as a normal pin again.",
  },
  {
    action: "hide",
    label: "Hide",
    tone: "ghost",
    description: "Hide from the public map without marking it resolved or fake.",
  },
];

const REPORT_ACTIONS: Action[] = [
  {
    action: "approve",
    label: "Approve",
    tone: "primary",
    description: "Restore to active status.",
  },
  {
    action: "hide",
    label: "Hide",
    tone: "ghost",
    description: "Hide from the public map.",
  },
  {
    action: "mark_false_alarm",
    label: "Mark false alarm",
    tone: "danger",
    description: "Marks the report as a false alarm.",
  },
  {
    action: "mark_resolved",
    label: "Mark resolved",
    tone: "primary",
    description: "Marks the report as resolved.",
  },
];

const SIGNAL_ACTIONS: Action[] = [
  { action: "approve", label: "Approve", tone: "primary", description: "Match the signal as relevant evidence." },
  { action: "ignore", label: "Ignore", tone: "ghost", description: "Ignore this public signal." },
  { action: "hide", label: "Hide", tone: "ghost", description: "Hide from public views." },
];

function buttonClass(tone: Action["tone"]) {
  switch (tone) {
    case "primary":
      return "bg-[#2454d6] text-white shadow-sm hover:bg-[#1e45b8]";
    case "blue":
      return "bg-blue-600 text-white shadow-sm hover:bg-blue-700";
    case "warning":
      return "bg-amber-500 text-white shadow-sm hover:bg-amber-600";
    case "danger":
      return "bg-rose-600 text-white shadow-sm hover:bg-rose-700";
    case "ghost":
    default:
      return "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50";
  }
}

export function ModerationPanel({
  target_type,
  target_id,
}: {
  target_type?: ModerationTarget;
  target_id?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!target_type || !target_id) {
    return (
      <Card className="grid gap-3 p-5">
        <h3 className="text-lg font-semibold text-slate-950">Moderator Tools</h3>
        <p className="text-sm leading-7 text-slate-600">
          Approve, hide, mark false alarm, merge duplicates, override status, and leave moderator notes through the admin API routes.
        </p>
      </Card>
    );
  }

  const actions =
    target_type === "cluster" ? CLUSTER_ACTIONS : target_type === "report" ? REPORT_ACTIONS : SIGNAL_ACTIONS;

  const apply = (action: string, label: string) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_type, target_id, action }),
        });
        const payload = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !payload.ok) {
          setMessage({ text: payload.error || "Action failed.", tone: "err" });
          return;
        }
        setMessage({ text: `${label} applied.`, tone: "ok" });
        router.refresh();
      } catch (error) {
        setMessage({ text: error instanceof Error ? error.message : "Action failed.", tone: "err" });
      }
    });
  };

  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Moderator Tools</h3>
        <p className="mt-1 text-xs text-slate-500">
          Government / moderators only. These actions update the public map immediately.
        </p>
      </div>
      <div className="grid gap-2">
        {actions.map((item) => (
          <div key={item.action} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="text-xs leading-5 text-slate-500">{item.description}</p>
            </div>
            <Button
              type="button"
              disabled={isPending}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs ${buttonClass(item.tone)}`}
              onClick={() => apply(item.action, item.label)}
            >
              {item.label}
            </Button>
          </div>
        ))}
      </div>
      {message ? (
        <p
          className={
            message.tone === "err"
              ? "rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
              : "rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
          }
        >
          {message.text}
        </p>
      ) : null}
    </Card>
  );
}
