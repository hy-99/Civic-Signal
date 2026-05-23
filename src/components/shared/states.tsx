import type { ReactNode } from "react";

import { AlertTriangle, Info, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid gap-4 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
        <Info className="h-5 w-5 text-blue-700" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="text-sm leading-7 text-slate-600">{body}</p>
      </div>
      {action}
    </Card>
  );
}

export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="grid gap-3 border-rose-200 bg-rose-50 p-6">
      <div className="flex items-center gap-3 text-rose-700">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-7 text-slate-700">{body}</p>
    </Card>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[1.5rem] bg-slate-100", className)} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">{eyebrow}</p> : null}
        <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm leading-7 text-slate-600">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card className="grid gap-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</p>
      {detail ? <p className="text-sm text-slate-500">{detail}</p> : null}
    </Card>
  );
}

export function ActionPlanCard({ text }: { text: string | null | undefined }) {
  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-center gap-3 text-blue-700">
        <TrendingUp className="h-5 w-5" />
        <h3 className="font-semibold">Recommended Action</h3>
      </div>
      <p className="text-sm leading-7 text-slate-600">{text || "Monitor for updates and route to the right responder."}</p>
    </Card>
  );
}

export function EvidenceCard({
  title,
  body,
  meta,
}: {
  title: string;
  body: string;
  meta?: string;
}) {
  return (
    <Card className="grid gap-3 p-5">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="text-sm leading-7 text-slate-600">{body}</p>
      {meta ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{meta}</p> : null}
    </Card>
  );
}
