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
      <h3 className="text-lg font-semibold text-slate-950">Citizen Verification</h3>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:bg-emerald-700"
          onClick={() => submitVote("confirm")}
          disabled={isPending}
        >
          Verify
        </Button>
        <Button
          type="button"
          className="border border-slate-300 bg-slate-50 text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900"
          variant="secondary"
          onClick={() => submitVote("resolved")}
          disabled={isPending}
        >
          Not there
        </Button>
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </Card>
  );
}
