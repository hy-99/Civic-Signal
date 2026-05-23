"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

type LaunchButtonProps = {
  onLaunch: () => void;
  disabled?: boolean;
};

export function LaunchButton({ onLaunch, disabled }: LaunchButtonProps) {
  return (
    <Link
      href="/app/map"
      prefetch
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        if (disabled) return;
        onLaunch();
      }}
      aria-disabled={disabled ? "true" : undefined}
      className="inline-flex items-center gap-2 rounded-xl bg-[#ffd84d] px-6 py-4 text-sm font-black text-slate-950 shadow-[0_18px_36px_rgba(255,216,77,0.28)] transition hover:bg-[#ffe681] disabled:cursor-not-allowed"
    >
      Open Live Map
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
