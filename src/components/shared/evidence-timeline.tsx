import type { ReportUpdate } from "@/lib/types";

import { Card } from "@/components/ui/primitives";
import { formatDateTime, titleCase } from "@/lib/utils";

export function EvidenceTimeline({ updates }: { updates: ReportUpdate[] }) {
  return (
    <Card className="grid gap-4 p-5">
      <h3 className="text-lg font-semibold text-slate-950">Evidence Timeline</h3>
      <div className="grid gap-4">
        {updates.map((update) => (
          <div key={update.id} className="relative border-l border-slate-200 pl-5">
            <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{titleCase(update.update_type)}</p>
            <p className="mt-1 text-sm text-slate-700">{update.text}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(update.created_at)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
