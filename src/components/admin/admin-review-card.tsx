"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ReviewQueueItem } from "@/lib/types";
import { Button, Card } from "@/components/ui/primitives";
import { ConfidenceBadge, RiskBadge } from "@/components/shared/badges";
import { formatRelativeTime } from "@/lib/utils";

export function AdminReviewCard({ item }: { item: ReviewQueueItem }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const runModeration = (action: "approve" | "hide" | "mark_false_alarm" | "mark_resolved" | "mark_duplicate") => {
    startTransition(async () => {
      const response = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: item.type,
          target_id: item.id,
          action,
          reason: `Moderator action from review queue: ${action}`,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setMessage(payload.ok ? `Action saved: ${action.replace(/_/g, " ")}.` : payload.error || "Unable to moderate item.");
      router.refresh();
    });
  };

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.type}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
        </div>
        <div className="flex gap-2">
          <RiskBadge risk_level={item.risk_score >= 75 ? "urgent" : item.risk_score >= 50 ? "serious" : item.risk_score >= 25 ? "watch" : "low"} />
          <ConfidenceBadge confidence_label={item.confidence_score >= 85 ? "very_high" : item.confidence_score >= 70 ? "high" : item.confidence_score >= 50 ? "medium" : item.confidence_score >= 25 ? "low" : "very_low"} />
        </div>
      </div>
      <p className="text-sm leading-7 text-slate-600">{item.description}</p>
      <div className="grid gap-2 text-sm text-slate-600">
        <div>Reason: {item.reason_for_review}</div>
        <div>Location: {item.location}</div>
        <div>Created: {formatRelativeTime(item.created_at)}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" type="button" disabled={isPending} onClick={() => runModeration("approve")}>Approve</Button>
        <Button variant="ghost" type="button" disabled={isPending} onClick={() => runModeration("hide")}>Hide</Button>
        <Button variant="danger" type="button" disabled={isPending} onClick={() => runModeration("mark_false_alarm")}>False Alarm</Button>
        <Button variant="secondary" type="button" disabled={isPending} onClick={() => runModeration("mark_resolved")}>Resolved</Button>
        {item.type === "report" ? (
          <Button variant="ghost" type="button" disabled={isPending} onClick={() => runModeration("mark_duplicate")}>Duplicate</Button>
        ) : null}
      </div>
      {message ? <p className="text-sm font-medium text-blue-700">{message}</p> : null}
    </Card>
  );
}
