import test from "node:test";
import assert from "node:assert/strict";

import { findMatchingClusterInState } from "@/services/clusters";
import { createInitialState } from "@/lib/mock-data";

test("nearby reports match an existing relevant cluster", () => {
  const state = createInitialState();
  const existing = state.risk_clusters.find((cluster) => cluster.category === "public_disturbance");
  assert.ok(existing);

  const match = findMatchingClusterInState(state, {
    category: existing.category,
    latitude: existing.latitude,
    longitude: existing.longitude,
    created_at: new Date().toISOString(),
  });

  assert.ok(match);
  assert.equal(match?.id, existing.id);
});

test("related public-space reports can match existing nearby clusters", () => {
  const state = createInitialState();
  const existing = state.risk_clusters.find((cluster) => cluster.category === "road_hazard");
  assert.ok(existing);

  const match = findMatchingClusterInState(state, {
    category: "traffic_obstruction",
    latitude: existing.latitude,
    longitude: existing.longitude,
    created_at: new Date().toISOString(),
  });

  assert.ok(match);
  assert.equal(match?.category, "road_hazard");
});
