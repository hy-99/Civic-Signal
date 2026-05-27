"use client";

import type { SourceFeed } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { StatusBadge } from "@/components/shared/badges";
import { Button, Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export function SourceFeedCard({ feed }: { feed: SourceFeed }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const runAction = (action: "test" | "scan") => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/sources/${feed.id}/${action}`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { imported_count?: number; duplicates_count?: number; preview_items?: unknown[] };
      };
      if (!payload.ok) {
        setMessage(payload.error || "Request failed.");
        return;
      }
      const duplicateNote =
        action === "scan" && (payload.data?.duplicates_count || 0) > 0 ? ` ${payload.data?.duplicates_count} duplicate(s) skipped.` : "";
      setMessage(
        action === "scan"
          ? `Scan imported ${payload.data?.imported_count || 0} signal(s).${duplicateNote}`
          : `Preview ready for ${payload.data?.preview_items?.length || 0} item(s).`,
      );
      window.setTimeout(() => router.refresh(), 450);
    });
  };

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{feed.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{feed.source_type}</p>
        </div>
        <StatusBadge status={feed.is_active ? "active" : "hidden"} />
      </div>
      <div className="grid gap-2 text-sm text-slate-600">
        <div>Default area: {feed.default_city || "Not set"}</div>
        <div>Trust level: {feed.trust_level}</div>
        <div>Last checked: {formatDateTime(feed.last_checked_at)}</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" type="button" disabled={isPending} onClick={() => runAction("test")}>
          Test Fetch
        </Button>
        <Button type="button" disabled={isPending} onClick={() => runAction("scan")}>
          Scan Now
        </Button>
      </div>
      {message ? <p className="text-sm font-medium text-blue-700">{message}</p> : null}
    </Card>
  );
}
