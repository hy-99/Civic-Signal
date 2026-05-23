"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui/primitives";

export function VerificationButtons({
  entity,
  entity_id,
}: {
  entity: "report" | "cluster";
  entity_id: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const submitVote = (vote_type: string) => {
    startTransition(async () => {
      const endpoint =
        entity === "report"
          ? `/api/reports/${entity_id}/vote`
          : `/api/risks/${entity_id}/vote`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      setMessage(payload.ok ? `Saved: ${vote_type}.` : payload.error || "Unable to save vote.");
      router.refresh();
    });
  };

  return (
    <Card className="grid gap-4 p-5">
      <h3 className="text-lg font-semibold text-slate-950">Verification Actions</h3>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700"
          onClick={() => submitVote("confirm")}
          disabled={isPending}
        >
          Confirm
        </Button>
        <Button
          type="button"
          className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm shadow-rose-100 hover:bg-rose-100 hover:text-rose-800"
          variant="secondary"
          onClick={() => submitVote("dispute")}
          disabled={isPending}
        >
          Dispute
        </Button>
        <Button
          type="button"
          className="border border-sky-200 bg-sky-50 text-sky-700 shadow-sm shadow-sky-100 hover:bg-sky-100 hover:text-sky-800"
          variant="secondary"
          onClick={() => submitVote("resolved")}
          disabled={isPending}
        >
          Resolved
        </Button>
        {entity === "report" ? (
          <Button type="button" variant="ghost" onClick={() => submitVote("duplicate")} disabled={isPending}>
            Duplicate
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </Card>
  );
}
