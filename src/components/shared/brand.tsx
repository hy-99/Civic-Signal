import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  variant?: "default" | "compact" | "hero";
  className?: string;
};

export function BrandWordmark({ variant = "default", className }: BrandWordmarkProps) {
  return (
    <span className={cn("cs-brand", `cs-brand--${variant}`, className)}>
      <span className="cs-brand__pulse" aria-hidden="true" />
      <span className="cs-brand__name">
        <span className="cs-brand__civic">CIVIC</span>
        <span className="cs-brand__dot" aria-hidden="true">·</span>
        <span className="cs-brand__signal">SIGNAL</span>
      </span>
      {variant !== "compact" ? (
        <span className="cs-brand__feed" aria-hidden="true">LIVE</span>
      ) : null}
    </span>
  );
}
