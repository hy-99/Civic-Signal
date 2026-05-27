import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "@/lib/mock-data";
import type { GeoJsonGeometry } from "@/lib/types";
import { bufferPolygonMeters } from "@/lib/geo/buffer";
import { computeAutoZoneGeometry } from "@/services/zones/auto-compute";
import { approveDangerZoneInState, getPublicDangerZonesFromState } from "@/services/zones";
import { withSerializedTest } from "@/tests/support/serialized";
import { recomputeZonesInState } from "@/workers/zone-recompute";

test("computeAutoZoneGeometry falls back to a buffered polygon when cluster points are colinear", () => {
  const geometry = computeAutoZoneGeometry(
    [
      { latitude: 37.77, longitude: -122.42 },
      { latitude: 37.771, longitude: -122.42 },
      { latitude: 37.772, longitude: -122.42 },
    ],
    { buffer_meters: 180 },
  );

  assert.equal(geometry.type, "Polygon");
  assert.ok(geometry.coordinates[0].length >= 4);
});

test("bufferPolygonMeters returns the original polygon when the buffer distance is zero", () => {
  const polygon: GeoJsonGeometry = {
    type: "Polygon",
    coordinates: [
      [
        [-122.42, 37.77],
        [-122.418, 37.77],
        [-122.418, 37.772],
        [-122.42, 37.772],
        [-122.42, 37.77],
      ],
    ],
  };

  assert.deepEqual(bufferPolygonMeters(polygon, 0), polygon);
});

test("zone recompute creates pending computed zones that only become public after approval", async () => {
  await withSerializedTest(async () => {
    const previousAutoApprove = process.env.AUTO_APPROVE_ZONES;
    process.env.AUTO_APPROVE_ZONES = "false";

    try {
      const state = createInitialState();
      const cluster = state.risk_clusters[0];
      assert.ok(cluster);

      state.danger_zones = state.danger_zones.filter((zone) => zone.cluster_id !== cluster.id);

      const linkedReportIds = state.cluster_items
        .filter((item) => item.cluster_id === cluster.id && item.item_type === "report")
        .map((item) => item.item_id);
      const reports = state.reports.filter((report) => linkedReportIds.includes(report.id));
      assert.ok(reports.length >= 2);

      reports[0].latitude = 37.77;
      reports[0].longitude = -122.42;
      reports[0].created_at = "2026-05-26T11:00:00.000Z";
      reports[1].latitude = 37.774;
      reports[1].longitude = -122.414;
      reports[1].created_at = "2026-05-26T11:35:00.000Z";
      if (reports[2]) {
        reports[2].latitude = 37.772;
        reports[2].longitude = -122.418;
        reports[2].created_at = "2026-05-26T11:20:00.000Z";
      }

      const summary = recomputeZonesInState(state, { now: "2026-05-26T12:00:00.000Z" });
      assert.ok(summary.created >= 1);

      const autoZone = state.danger_zones.find((zone) => zone.cluster_id === cluster.id && zone.mode === "auto");
      assert.ok(autoZone);
      assert.equal(autoZone.type, "official_active_zone");
      assert.equal(autoZone.approved_at, null);

      const predictedZone = state.danger_zones.find((zone) => zone.cluster_id === cluster.id && zone.mode === "predicted");
      assert.ok(predictedZone);
      assert.equal(predictedZone.type, "official_predicted_zone");
      assert.equal(predictedZone.approved_at, null);

      assert.equal(
        getPublicDangerZonesFromState(state).some((zone) => zone.id === autoZone.id || zone.id === predictedZone.id),
        false,
      );

      approveDangerZoneInState(state, autoZone.id, "moderator-1");
      assert.equal(getPublicDangerZonesFromState(state).some((zone) => zone.id === autoZone.id), true);
    } finally {
      if (previousAutoApprove === undefined) delete process.env.AUTO_APPROVE_ZONES;
      else process.env.AUTO_APPROVE_ZONES = previousAutoApprove;
    }
  });
});
