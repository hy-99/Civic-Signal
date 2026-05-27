"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { CaseOpsRoleMode } from "@/lib/types";

const ROLE_MODES: CaseOpsRoleMode[] = ["citizen", "police", "government"];

export type ThemePreference = "light" | "dark" | "system";
export type DistanceUnits = "metric" | "imperial";

const STORAGE_KEY = "cs-settings-v1";

type SettingsState = {
  theme: ThemePreference;
  units: DistanceUnits;
  roleMode: CaseOpsRoleMode;
};

type SettingsContextValue = SettingsState & {
  effectiveTheme: "light" | "dark";
  setTheme: (next: ThemePreference) => void;
  setUnits: (next: DistanceUnits) => void;
  setRoleMode: (next: CaseOpsRoleMode) => void;
};

const DEFAULTS: SettingsState = {
  theme: "light",
  units: "metric",
  roleMode: "citizen",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStoredSettings(): SettingsState {
  if (typeof window === "undefined") return DEFAULTS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    const storedRole = parsed.roleMode ?? DEFAULTS.roleMode;
    return {
      theme: parsed.theme ?? DEFAULTS.theme,
      units: parsed.units ?? DEFAULTS.units,
      roleMode: ROLE_MODES.includes(storedRole) ? storedRole : DEFAULTS.roleMode,
    };
  } catch {
    return DEFAULTS;
  }
}

function readSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(() => readStoredSettings());
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => readSystemTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const effectiveTheme = state.theme === "system" ? systemTheme : state.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", effectiveTheme === "dark");
    root.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setState((current) => ({ ...current, theme: next }));
  }, []);

  const setUnits = useCallback((next: DistanceUnits) => {
    setState((current) => ({ ...current, units: next }));
  }, []);

  const setRoleMode = useCallback((next: CaseOpsRoleMode) => {
    setState((current) => ({ ...current, roleMode: next }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...state, effectiveTheme, setTheme, setUnits, setRoleMode }),
    [state, effectiveTheme, setTheme, setUnits, setRoleMode],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      theme: DEFAULTS.theme,
      units: DEFAULTS.units,
      roleMode: DEFAULTS.roleMode,
      effectiveTheme: "light" as const,
      setTheme: () => {},
      setUnits: () => {},
      setRoleMode: () => {},
    };
  }
  return ctx;
}
