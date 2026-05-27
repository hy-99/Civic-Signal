import assert from "node:assert/strict";
import test from "node:test";

import { loadState, resetDemoState, withMutableState } from "@/lib/data-store";
import { bus } from "@/lib/events/bus";
import { createInitialState } from "@/lib/mock-data";
import { findBestClusterMatchInState, linkReportToClusterInState } from "@/services/clusters";
import { createReport } from "@/services/reports";
import { withSerializedTest } from "@/tests/support/serialized";

test("combined matcher can choose a semantic match when distance is outside the normal cluster radius", () => {
  const state = createInitialState();
  state.risk_clusters = [
    {
      ...state.risk_clusters[0]!,
      id: "semantic-cluster",
      category: "fallen_tree",
      latitude: 37.7749,
      longitude: -122.4194,
      radius_meters: 350,
      last_activity_at: new Date().toISOString(),
      embedding: [1, 0, 0],
    },
  ];

  const match = findBestClusterMatchInState(state, {
    category: "traffic_obstruction",
    latitude: 37.7839,
    longitude: -122.4194,
    created_at: new Date().toISOString(),
    embedding: [1, 0, 0],
  });

  assert.ok(match);
  assert.equal(match?.cluster.id, "semantic-cluster");
  assert.equal(match?.reason, "semantic");
  assert.ok((match?.semantic_similarity || 0) >= 0.99);
});

test("linkReportToClusterInState records semantic audit text when semantic similarity drives the match", async () => {
  const state = createInitialState();
  state.reports = [];
  state.public_signals = [];
  state.report_updates = [];
  state.cluster_items = [];
  state.risk_clusters = [
    {
      ...state.risk_clusters[0]!,
      id: "semantic-cluster",
      category: "fallen_tree",
      latitude: 37.7749,
      longitude: -122.4194,
      radius_meters: 350,
      last_activity_at: new Date().toISOString(),
      embedding: [1, 0, 0],
    },
  ];

  const report = {
    ...createInitialState().reports[0]!,
    id: "semantic-report",
    category: "traffic_obstruction" as const,
    latitude: 37.7839,
    longitude: -122.4194,
    embedding: [1, 0, 0],
    cluster_id: null,
  };
  state.reports.push(report);

  const result = await linkReportToClusterInState(state, report);

  assert.equal(result.match?.reason, "semantic");
  assert.equal(report.cluster_id, "semantic-cluster");
  assert.ok(state.report_updates.some((entry) => /matched via semantic similarity/i.test(entry.text)));
});

test("createReport emits report.clustered with match_reason=semantic for semantically similar incidents beyond the normal radius", async () => {
  await withSerializedTest(async () => {
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      await resetDemoState();
      await withMutableState((state) => {
        state.reports = [];
        state.public_signals = [];
        state.risk_clusters = [];
        state.cluster_items = [];
        state.report_updates = [];
        state.ai_cache = [];
        state.incident_cases = [];
        state.case_events = [];
      });

      const first = await createReport({
        title: "Fallen oak tree blocking Main Street",
        description: "A large tree is down across Main Street after the storm.",
        category: "fallen_tree",
        urgency: "serious",
        address_text: "Main Street",
        latitude: 37.7749,
        longitude: -122.4194,
        image_url: null,
        image_storage_path: null,
        is_anonymous: false,
      });

      const clusteredEvents: Array<{ report_id: string; cluster_id: string; match_reason: string }> = [];
      const unsubscribe = bus.subscribe({
        id: "semantic-match-event-test",
        emit(event) {
          if (event.type === "report.clustered") {
            clusteredEvents.push({
              report_id: event.report_id,
              cluster_id: event.cluster_id,
              match_reason: event.match_reason,
            });
          }
        },
      });

      try {
        const second = await createReport({
          title: "Huge branch down on Main Street",
          description: "Big limb blocking the road near Main Street after high winds.",
          category: "traffic_obstruction",
          urgency: "serious",
          address_text: "Main Street",
          latitude: 37.7839,
          longitude: -122.4194,
          image_url: null,
          image_storage_path: null,
          is_anonymous: false,
        });

        const state = await loadState();
        const savedSecond = state.reports.find((report) => report.id === second.id);
        assert.ok(first.cluster?.id);
        assert.equal(savedSecond?.cluster_id, first.cluster?.id);
        assert.ok(clusteredEvents.some((event) => event.report_id === second.id && event.match_reason === "semantic"));
        assert.ok(
          state.report_updates.some(
            (entry) => entry.report_id === second.id && /matched via semantic similarity/i.test(entry.text),
          ),
        );
      } finally {
        unsubscribe();
      }
    } finally {
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
    }
  });
});
