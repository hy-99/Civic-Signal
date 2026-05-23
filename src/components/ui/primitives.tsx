import type { ComponentPropsWithRef, ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-[#2454d6] text-white shadow-sm hover:bg-[#1e45b8]",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        variant === "danger" && "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "accent" | "success" | "caution" | "warning" | "danger";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-700",
        tone === "accent" && "border-blue-200 bg-blue-50 text-blue-700",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "caution" && "border-yellow-200 bg-yellow-50 text-yellow-800",
        tone === "warning" && "border-orange-200 bg-orange-50 text-orange-700",
        tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm placeholder:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm placeholder:text-slate-400",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  help,
  children,
  labelClassName,
  helpClassName,
}: {
  label: string;
  help?: string;
  children: ReactNode;
  labelClassName?: string;
  helpClassName?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className={cn("font-semibold text-slate-900", labelClassName)}>{label}</span>
      {children}
      {help ? <span className={cn("text-xs text-slate-500", helpClassName)}>{help}</span> : null}
    </label>
  );
}
