"use client";

import { Monitor, Moon, RotateCcw, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSettings, type DistanceUnits, type ThemePreference } from "@/components/providers/settings-provider";
import { CASEOPS_ROLE_MODES } from "@/lib/constants";
import type { CaseOpsRoleMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const UNIT_OPTIONS: { value: DistanceUnits; label: string }[] = [
  { value: "metric", label: "Kilometers" },
  { value: "imperial", label: "Miles" },
];

const ROLE_LABELS: Record<CaseOpsRoleMode, string> = {
  citizen: "Citizen",
  police: "Police",
  moderator: "Moderator",
  government: "Government",
  responder: "Responder",
};

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, units, roleMode, setTheme, setUnits, setRoleMode } = useSettings();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetDemo = async () => {
    setResetState("loading");
    setResetMessage(null);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      const payload = (await response.json()) as { ok: boolean; data?: { reports: number; clusters: number }; error?: string };
      if (!payload.ok) {
        setResetState("error");
        setResetMessage(payload.error || "Reset failed.");
        return;
      }
      setResetState("done");
      setResetMessage(`Reset · ${payload.data?.clusters ?? 0} hazards seeded.`);
      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setResetState("error");
      setResetMessage("Reset failed.");
    }
  };

  return (
    <div className="cs-settings" ref={ref}>
      <button
        type="button"
        className="cs-settings__btn"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Settings className="h-4 w-4" />
      </button>

      {open ? (
        <div className="cs-settings__panel" role="dialog" aria-label="Settings">
          <div className="cs-settings__header">
            <h3>Settings</h3>
            <span>Demo</span>
          </div>

          <section className="cs-settings__section">
            <p className="cs-settings__label">CaseOps role mode</p>
            <div className="cs-settings__seg cs-settings__seg--wrap" role="radiogroup" aria-label="CaseOps role mode">
              {CASEOPS_ROLE_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={roleMode === value}
                  onClick={() => setRoleMode(value)}
                  className={cn("cs-settings__seg-btn", roleMode === value && "cs-settings__seg-btn--active")}
                >
                  {ROLE_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="cs-settings__help">
              Controls map layers and actions without opening a separate dashboard.
            </p>
          </section>

          <section className="cs-settings__section">
            <p className="cs-settings__label">Appearance</p>
            <div className="cs-settings__seg" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn("cs-settings__seg-btn", theme === value && "cs-settings__seg-btn--active")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="cs-settings__section">
            <p className="cs-settings__label">Distance units</p>
            <div className="cs-settings__seg" role="radiogroup" aria-label="Distance units">
              {UNIT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={units === value}
                  onClick={() => setUnits(value)}
                  className={cn("cs-settings__seg-btn", units === value && "cs-settings__seg-btn--active")}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="cs-settings__help">
              Used by the Priority Board distance calculation.
            </p>
          </section>

          <section className="cs-settings__section">
            <p className="cs-settings__label">Demo data</p>
            <button
              type="button"
              onClick={resetDemo}
              disabled={resetState === "loading"}
              className="cs-settings__reset"
            >
              <RotateCcw className={cn("h-3.5 w-3.5", resetState === "loading" && "animate-spin")} />
              {resetState === "loading" ? "Resetting…" : "Reset demo data"}
            </button>
            {resetMessage ? (
              <p
                className={cn(
                  "cs-settings__help",
                  resetState === "error" ? "cs-settings__help--error" : "cs-settings__help--ok",
                )}
              >
                {resetMessage}
              </p>
            ) : (
              <p className="cs-settings__help">Clears submitted reports, restores the 5 seeded hazards.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
