"use client";

import { useState } from "react";

import type { MapFilters } from "@/lib/types";

export function useMapFilters(initialFilters: MapFilters = {}) {
  const [filters, setFilters] = useState<MapFilters>(initialFilters);
  return {
    filters,
    setFilters,
  };
}
