"use client";

import { useState } from "react";

import type { AuthViewer } from "@/lib/types";

export function useCurrentUser(initialViewer: AuthViewer | null = null) {
  const [viewer] = useState<AuthViewer | null>(initialViewer);
  return viewer;
}
