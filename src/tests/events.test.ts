import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "@/lib/mock-data";
import { bus } from "@/lib/events/bus";
import { buildCaseStatusChangedEvent, buildReportLifecycleEvents, buildSignalLifecycleEvents, inferZoneMode } from "@/lib/events/domain";
import type { CivicEvent } from "@/lib/events/types";
import { formatSseEvent, formatSseHeartbeat, formatSseRetry } from "@/lib/events/sse";
import { buildEventStreamUrl, getReconnectDelay } from "@/hooks/use-event-stream";
import { GET } from "@/app/api/events/stream/route";

function sampleEvents() {
  const state = createInitialState();
  const report = state.reports[0];
  const cluster = state.risk_clusters[0];
  const incident = state.incident_cases[0];
  const zone = state.danger_zones[0];
  const caseEvent = state.case_events.find((event) => event.case_id === incident.id) ?? state.case_events[0];
  const signal = state.public_signals[0];

  assert.ok(report);
  assert.ok(cluster);
  assert.ok(incident);
  assert.ok(zone);
  assert.ok(caseEvent);
  assert.ok(signal);

  return {
    reportCreated: { type: "report.created", report } satisfies CivicEvent,
    clusterUpdated: { type: "cluster.updated", cluster } satisfies CivicEvent,
    caseCreated: { type: "case.created", case: incident } satisfies CivicEvent,
    caseEventAdded: { type: "case.event_added", case_id: incident.id, event: caseEvent } satisfies CivicEvent,
    signalIngested: { type: "signal.ingested", signal, source: signal.source_type } satisfies CivicEvent,
    zoneComputed: { type: "zone.computed", zone, mode: "manual" } satisfies CivicEvent,
  };
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, pattern: string, maxChunks = 4) {
  const decoder = new TextDecoder();
  let output = "";
  for (let index = 0; index < maxChunks; index += 1) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
    if (output.includes(pattern)) break;
  }
  return output;
}

test("event bus emits to subscribers", () => {
  const events = sampleEvents();
  const received: CivicEvent[] = [];
  const unsubscribe = bus.subscribe({
    id: "events-basic",
    emit(event) {
      received.push(event);
    },
  });

  bus.emit(events.reportCreated);
  unsubscribe();

  assert.deepEqual(received, [events.reportCreated]);
});

test("event bus applies subscriber filters", () => {
  const events = sampleEvents();
  const received: CivicEvent[] = [];
  const unsubscribe = bus.subscribe({
    id: "events-filter",
    filter(event) {
      return event.type === "case.created";
    },
    emit(event) {
      received.push(event);
    },
  });

  bus.emit(events.reportCreated);
  bus.emit(events.caseCreated);
  unsubscribe();

  assert.deepEqual(received, [events.caseCreated]);
});

test("event bus unsubscribe stops future events", () => {
  const events = sampleEvents();
  let count = 0;
  const unsubscribe = bus.subscribe({
    id: "events-unsubscribe",
    emit() {
      count += 1;
    },
  });

  unsubscribe();
  bus.emit(events.clusterUpdated);

  assert.equal(count, 0);
});

test("event bus fanout reaches multiple subscribers", () => {
  const events = sampleEvents();
  const receivedA: CivicEvent[] = [];
  const receivedB: CivicEvent[] = [];
  const unsubscribeA = bus.subscribe({
    id: "events-multi-a",
    emit(event) {
      receivedA.push(event);
    },
  });
  const unsubscribeB = bus.subscribe({
    id: "events-multi-b",
    emit(event) {
      receivedB.push(event);
    },
  });

  bus.emit(events.signalIngested);
  unsubscribeA();
  unsubscribeB();

  assert.deepEqual(receivedA, [events.signalIngested]);
  assert.deepEqual(receivedB, [events.signalIngested]);
});

test("SSE helpers format event, retry, and heartbeat frames", () => {
  const events = sampleEvents();

  assert.equal(formatSseEvent(events.reportCreated), `event: report.created\ndata: ${JSON.stringify(events.reportCreated)}\n\n`);
  assert.equal(formatSseRetry(1500), "retry: 1500\n\n");
  assert.equal(formatSseHeartbeat(), ": heartbeat\n\n");
});

test("event stream URL only includes requested event types", () => {
  assert.equal(buildEventStreamUrl(), "/api/events/stream");
  assert.equal(
    buildEventStreamUrl({ types: ["report.created", "case.created"] }),
    "/api/events/stream?types=report.created%2Ccase.created",
  );
});

test("event stream reconnect delay backs off and caps", () => {
  assert.equal(getReconnectDelay(0), 1000);
  assert.equal(getReconnectDelay(1), 2000);
  assert.equal(getReconnectDelay(4), 10000);
  assert.equal(getReconnectDelay(10), 10000);
});

test("report lifecycle helpers emit created, scored, and clustered payloads", () => {
  const state = createInitialState();
  const report = state.reports[0];
  assert.ok(report);
  report.cluster_id = state.risk_clusters[0]?.id ?? null;

  const events = buildReportLifecycleEvents(report, "spatial");

  assert.deepEqual(events.map((event) => event.type), ["report.created", "report.scored", "report.clustered"]);
  assert.equal(events[0].report.id, report.id);
  assert.equal(events[1].risk_score, report.risk_score);
  assert.equal(events[2].cluster_id, report.cluster_id);
});

test("signal lifecycle helpers emit ingested and classified payloads", () => {
  const state = createInitialState();
  const signal = state.public_signals[0];
  assert.ok(signal);
  signal.analysis_json.extracted_location_text = "Mission District";
  signal.analysis_json.source_confidence = 88;

  const events = buildSignalLifecycleEvents(signal);

  assert.deepEqual(events.map((event) => event.type), ["signal.ingested", "signal.classified"]);
  assert.equal(events[0].signal.id, signal.id);
  assert.equal(events[1].result.extracted_location_text, "Mission District");
  assert.equal(events[1].result.source_confidence, 88);
});

test("zone mode inference maps current zone types into stream modes", () => {
  const state = createInitialState();
  const zone = state.danger_zones[0];
  assert.ok(zone);

  assert.equal(inferZoneMode({ ...zone, type: "official_active_zone" }), "manual");
  assert.equal(inferZoneMode({ ...zone, type: "official_predicted_zone" }), "predicted");
  assert.equal(inferZoneMode({ ...zone, type: "ai_suggested_zone" }), "ai_suggested");
});

test("case status helper keeps old and new values", () => {
  const event = buildCaseStatusChangedEvent("case-123", "triage", "assigned");

  assert.deepEqual(event, {
    type: "case.status_changed",
    case_id: "case-123",
    from: "triage",
    to: "assigned",
  });
});

test("event stream route only forwards matching event types", async () => {
  const events = sampleEvents();
  const controller = new AbortController();
  const response = await GET(
    new Request("http://localhost:3000/api/events/stream?types=case.created", {
      signal: controller.signal,
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = response.body?.getReader();
  assert.ok(reader);

  bus.emit(events.reportCreated);
  bus.emit(events.caseCreated);

  const chunk = await readUntil(reader, "event: case.created");

  assert.match(chunk, /event: case\.created/);
  assert.doesNotMatch(chunk, /report\.created/);

  controller.abort();
  await reader.cancel();
});
