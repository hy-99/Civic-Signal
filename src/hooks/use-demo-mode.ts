"use client";

import { isDemoMode } from "@/lib/env";

export function useDemoMode() {
  return isDemoMode();
}
