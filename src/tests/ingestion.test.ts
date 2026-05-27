import assert from "node:assert/strict";
import test from "node:test";

import { bus } from "@/lib/events/bus";
import { loadState, resetDemoState } from "@/lib/data-store";
import { createSourceFeed, scanSourceFeed, testSourceFeed } from "@/services/source-feeds";
import { withSerializedTest } from "@/tests/support/serialized";

function installFetchMock(
  responder: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  const originalFetch = global.fetch;
  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return responder(url, init);
  }) as typeof fetch;

  return () => {
    global.fetch = originalFetch;
  };
}

test("Unit B ingestion replaces mock scans with live parser behavior", async (t) => {
  await withSerializedTest(async () => {
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";
    t.after(() => {
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
    });

    await t.test("scanSourceFeed imports USGS items once and dedups reruns", async () => {
    await resetDemoState();

    const feed = await createSourceFeed({
      name: "USGS Significant Earthquakes",
      url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson",
      source_type: "usgs" as never,
      trust_level: 88,
      is_active: true,
      keywords: ["earthquake"],
      default_city: "San Francisco, CA",
      default_latitude: 37.7749,
      default_longitude: -122.4194,
    });

    const restoreFetch = installFetchMock(async (url) => {
      assert.equal(url, feed.url);
      return new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              id: "us7000unitb",
              properties: {
                mag: 6.1,
                place: "12 km NW of Testville",
                title: "M 6.1 - 12 km NW of Testville",
                time: 1_717_111_111_000,
                detail: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000unitb",
              },
              geometry: {
                type: "Point",
                coordinates: [-122.4, 37.78, 10.2],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const events: Array<{ type: string; items_added?: number }> = [];
    const unsubscribe = bus.subscribe({
      id: "ingestion-test-usgs",
      emit(event) {
        if (event.type === "feed.scanned") {
          events.push({ type: event.type, items_added: event.items_added });
        }
      },
    });

    try {
      const first = await scanSourceFeed(feed.id);
      assert.equal(first.imported_count, 1);
      assert.equal(first.items[0]?.external_id, "us7000unitb");
      assert.match(first.items[0]?.title || "", /M 6\.1 - 12 km NW of Testville/);
      assert.equal(first.mode, undefined);

      const second = await scanSourceFeed(feed.id);
      assert.equal(second.imported_count, 0);
      assert.equal(second.duplicates_count, 1);

      assert.deepEqual(events, [
        { type: "feed.scanned", items_added: 1 },
        { type: "feed.scanned", items_added: 0 },
      ]);

      const state = await loadState();
      const matches = state.public_signals.filter((signal) => signal.source_feed_id === feed.id && signal.external_id === "us7000unitb");
      assert.equal(matches.length, 1);
    } finally {
      unsubscribe();
      restoreFetch();
    }
    });

    await t.test("testSourceFeed previews NWS alerts with the current API contract and User-Agent", async () => {
    await resetDemoState();

    const feed = await createSourceFeed({
      name: "NWS Active Alerts",
      url: "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
      source_type: "nws" as never,
      trust_level: 90,
      is_active: true,
      keywords: ["warning", "weather"],
      default_city: "San Francisco, CA",
      default_latitude: 37.7749,
      default_longitude: -122.4194,
    });

    const restoreFetch = installFetchMock(async (url, init) => {
      assert.equal(url.includes("limit="), false);

      const headers = new Headers(init?.headers);
      assert.match(headers.get("User-Agent") || "", /^CivicSignal\/1\.0/);

      return new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              id: "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.demo-alert.001.1",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-122.6, 37.7],
                    [-122.2, 37.7],
                    [-122.2, 37.9],
                    [-122.6, 37.9],
                    [-122.6, 37.7],
                  ],
                ],
              },
              properties: {
                event: "Flood Warning",
                headline: "Flood Warning issued for Test County",
                description: "Low-lying roads near the creek may flood tonight.",
                areaDesc: "Test County",
                severity: "Severe",
                sent: "2026-05-26T21:00:00-07:00",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/geo+json" },
        },
      );
    });

    try {
      const preview = await testSourceFeed(feed.id);
      const first = preview.preview_items[0] as { external_id?: string; title?: string; category?: string };
      assert.equal(preview.mode, "live_preview");
      assert.equal(first.external_id, "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.demo-alert.001.1");
      assert.equal(first.title, "Flood Warning issued for Test County");
      assert.equal(first.category, "flooding");
    } finally {
      restoreFetch();
    }
    });

    await t.test("testSourceFeed previews RSS items from the remote feed without persisting signals", async () => {
    await resetDemoState();

    const feed = await createSourceFeed({
      name: "NWS Bay Area RSS",
      url: "https://www.weather.gov/rss_page.php?site_name=mtr",
      source_type: "rss",
      trust_level: 74,
      is_active: true,
      keywords: ["weather", "hazard"],
      default_city: "San Francisco, CA",
      default_latitude: 37.7749,
      default_longitude: -122.4194,
    });

    const restoreFetch = installFetchMock(async (url) => {
      assert.equal(url, feed.url);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>San Francisco Bay Area, CA</title>
    <item>
      <guid>bay-area-rss-1</guid>
      <title>Beach Hazards Statement for the Pacific Coast</title>
      <link>https://www.weather.gov/mtr/</link>
      <description>Strong rip currents and breaking waves expected through Wednesday morning.</description>
      <pubDate>Tue, 26 May 2026 21:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,
        {
          status: 200,
          headers: { "content-type": "application/rss+xml" },
        },
      );
    });

    try {
      const preview = await testSourceFeed(feed.id);
      const first = preview.preview_items[0] as { external_id?: string; title?: string };
      assert.equal(preview.mode, "live_preview");
      assert.equal(first.external_id, "bay-area-rss-1");
      assert.equal(first.title, "Beach Hazards Statement for the Pacific Coast");

      const state = await loadState();
      const matches = state.public_signals.filter((signal) => signal.source_feed_id === feed.id);
      assert.equal(matches.length, 0);
    } finally {
      restoreFetch();
    }
    });

    await t.test("scanSourceFeed only imports Open-Meteo conditions that cross the hazard threshold", async () => {
    await resetDemoState();

    const feed = await createSourceFeed({
      name: "Open-Meteo Default City",
      url: "https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,weather_code,wind_speed_10m",
      source_type: "open_meteo" as never,
      trust_level: 68,
      is_active: true,
      keywords: ["wind", "weather"],
      default_city: "San Francisco, CA",
      default_latitude: 37.7749,
      default_longitude: -122.4194,
    });

    let currentWind = 12;
    const weatherCode = 0;
    const restoreFetch = installFetchMock(async (url) => {
      assert.equal(url, feed.url);
      return new Response(
        JSON.stringify({
          current: {
            time: "2026-05-26T21:45",
            temperature_2m: 14.2,
            weather_code: weatherCode,
            wind_speed_10m: currentWind,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });

    try {
      const calm = await scanSourceFeed(feed.id);
      assert.equal(calm.imported_count, 0);

      currentWind = 64;
      const hazardous = await scanSourceFeed(feed.id);
      assert.equal(hazardous.imported_count, 1);
      assert.match(hazardous.items[0]?.title || "", /High wind/i);
    } finally {
      restoreFetch();
    }
    });
  });
});
