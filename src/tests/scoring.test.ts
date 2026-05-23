import test from "node:test";
import assert from "node:assert/strict";

import { calculateDistanceMeters, calculateRecencyBonus, getConfidenceLabel, getRiskLevel, scoreReport } from "@/services/scoring";
import { createInitialState } from "@/lib/mock-data";

test("risk level thresholds match CivicSignal scoring bands", () => {
  assert.equal(getRiskLevel(10), "low");
  assert.equal(getRiskLevel(30), "watch");
  assert.equal(getRiskLevel(60), "serious");
  assert.equal(getRiskLevel(90), "urgent");
});

test("confidence labels match expected bands", () => {
  assert.equal(getConfidenceLabel(10), "very_low");
  assert.equal(getConfidenceLabel(30), "low");
  assert.equal(getConfidenceLabel(55), "medium");
  assert.equal(getConfidenceLabel(75), "high");
  assert.equal(getConfidenceLabel(95), "very_high");
});

test("recency bonus favors fresh reports", () => {
  const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const stale = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  assert.equal(calculateRecencyBonus(recent), 12);
  assert.equal(calculateRecencyBonus(stale), 0);
});

test("haversine distance returns local-scale meter distances", () => {
  const distance = calculateDistanceMeters(
    { latitude: 37.7784, longitude: -122.4266 },
    { latitude: 37.7789, longitude: -122.4261 },
  );

  assert.ok(distance > 60);
  assert.ok(distance < 90);
});

test("new public-space categories produce expected scoring bands", () => {
  const state = createInitialState();
  const report = state.reports.find((item) => item.category === "public_disturbance");
  assert.ok(report);

  const score = scoreReport(report, {
    nearby_related_reports: 0,
    related_signals: state.public_signals.filter((signal) => signal.cluster_id === report.cluster_id),
    confirmation_count: 1,
    dispute_count: 0,
    resolved_count: 0,
    high_trust_user: true,
  });

  assert.equal(score.risk_level, "urgent");
  assert.ok(["medium", "high", "very_high"].includes(score.confidence_label));
});
