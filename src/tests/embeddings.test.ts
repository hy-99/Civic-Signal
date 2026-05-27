import assert from "node:assert/strict";
import test from "node:test";

import { loadState, resetDemoState, withMutableState } from "@/lib/data-store";
import { createReport } from "@/services/reports";
import { getTextEmbedding } from "@/services/embeddings";
import { withSerializedTest } from "@/tests/support/serialized";

test("new reports persist a 768-d embedding in state", async () => {
  await withSerializedTest(async () => {
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      await resetDemoState();
      await withMutableState((state) => {
        state.reports = [];
        state.risk_clusters = [];
        state.cluster_items = [];
        state.report_updates = [];
        state.incident_cases = [];
        state.case_events = [];
        state.ai_cache = [];
      });

      const report = await createReport({
        title: "Fallen tree blocking Main Street",
        description: "A large tree branch is blocking a full lane after the storm.",
        category: "fallen_tree",
        urgency: "serious",
        address_text: "Main Street",
        latitude: 37.7749,
        longitude: -122.4194,
        image_url: null,
        image_storage_path: null,
        is_anonymous: false,
      });

      const state = await loadState();
      const saved = state.reports.find((item) => item.id === report.id);
      assert.ok(saved?.embedding);
      assert.equal(saved?.embedding?.length, 768);
    } finally {
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
    }
  });
});

test("embedding generation caches identical inputs and stores a single cache row per input", async () => {
  await withSerializedTest(async () => {
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";

    try {
      await resetDemoState();
      await withMutableState((state) => {
        state.ai_cache = [];
      });

      const first = await getTextEmbedding("fallen tree blocking main street");
      const second = await getTextEmbedding("fallen tree blocking main street");

      assert.equal(first.length, 768);
      assert.deepEqual(first, second);

      const state = await loadState();
      const cached = state.ai_cache.filter((entry) => entry.task_type === "embedding");
      assert.equal(cached.length, 1);
    } finally {
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
    }
  });
});
