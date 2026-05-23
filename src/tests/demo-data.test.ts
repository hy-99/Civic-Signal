import test from "node:test";
import assert from "node:assert/strict";

import { CATEGORY_CONFIG, CATEGORY_OPTIONS } from "@/lib/constants";
import { createInitialState } from "@/lib/mock-data";
import { reportCreateSchema } from "@/lib/validation";

test("new public-space categories are configured and valid for report creation", () => {
  for (const category of ["school_area_concern", "public_disturbance", "unauthorized_vending", "crowd_safety"] as const) {
    assert.ok(CATEGORY_CONFIG[category]);
    assert.ok(CATEGORY_OPTIONS.some((option) => option.value === category));
    assert.doesNotThrow(() =>
      reportCreateSchema.parse({
        title: "Reported public-space concern",
        description: "A place-based public-space condition needs verification from nearby community members.",
        category,
        urgency: "watch",
        address_text: "North Lake",
        latitude: 37.7749,
        longitude: -122.4194,
        image_url: null,
        image_storage_path: null,
        is_anonymous: false,
        agreed_to_accuracy: true,
      }),
    );
  }
});

test("curated demo data uses realistic public-space situations without generated audit titles", () => {
  const state = createInitialState();
  const titles = state.reports.map((report) => report.title);

  assert.ok(titles.includes("Smoke smell reported near Embarcadero Ferry walkway"));
  assert.ok(titles.includes("Reported public fight near transit stop"));
  assert.ok(titles.includes("Aggressive driving near school pickup zone"));
  assert.equal(titles.some((title) => title.toLowerCase().includes("browser audit")), false);
});

test("public demo reports exclude unresolved sensitive moderation items", () => {
  const state = createInitialState();
  const publicReports = state.reports.filter((report) => ["active", "verified", "resolved"].includes(report.status));

  assert.equal(publicReports.some((report) => report.title.includes("Named person accused")), false);
  assert.equal(publicReports.some((report) => report.status === "needs_review"), false);
});
