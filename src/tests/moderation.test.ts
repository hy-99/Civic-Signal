import test from "node:test";
import assert from "node:assert/strict";

import { checkReportForModeration } from "@/services/moderation";

test("urgent vague reports are flagged for review", () => {
  const result = checkReportForModeration({
    title: "Danger now",
    description: "Something bad here",
    urgency: "urgent",
    category: "other",
    image_url: null,
  });

  assert.equal(result.needs_review, true);
  assert.ok(result.moderation_flags.includes("vague_urgent_report"));
});

test("sensitive public-space reports with named accusations are held for moderation", () => {
  const result = checkReportForModeration({
    title: "Named student selling vapes",
    description: "Alex Morgan is definitely selling vapes after school near the walkway.",
    urgency: "serious",
    category: "unauthorized_vending",
    image_url: null,
  });

  assert.equal(result.needs_review, true);
  assert.ok(result.moderation_flags.includes("personal_accusation"));
  assert.ok(result.moderation_flags.includes("unsafe_claim"));
});
