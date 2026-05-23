import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/tmp/civicsignal-browser-audit";
const DEBUG_PORT = process.env.DEBUG_PORT || "9229";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

class CDPPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = [];
    this.isOpen = false;

    this.socket.addEventListener("open", () => {
      this.isOpen = true;
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data.toString());

      if (typeof message.id === "number" && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || "CDP command failed."));
        else resolve(message.result);
        return;
      }

      if (message.method) {
        const matched = [];
        for (const waiter of this.eventWaiters) {
          if (waiter.method === message.method && waiter.predicate(message.params)) {
            waiter.resolve(message.params);
            matched.push(waiter);
          }
        }
        this.eventWaiters = this.eventWaiters.filter((waiter) => !matched.includes(waiter));
      }
    });

    this.socket.addEventListener("error", (event) => {
      for (const { reject } of this.pending.values()) {
        reject(event.error || new Error("WebSocket error"));
      }
      this.pending.clear();
    });
  }

  async ready() {
    if (this.isOpen) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out opening DevTools socket.")), 10_000);
      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  async send(method, params = {}) {
    await this.ready();
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 20_000);
    });
    this.socket.send(payload);
    return result;
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const waiter = {
        method,
        predicate,
        resolve,
      };
      this.eventWaiters.push(waiter);
      setTimeout(() => {
        const index = this.eventWaiters.indexOf(waiter);
        if (index >= 0) {
          this.eventWaiters.splice(index, 1);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, timeoutMs);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result?.value;
  }

  async navigate(url) {
    const loaded = this.waitForEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url });
    await loaded;
    await delay(350);
  }

  async waitForExpression(expression, timeoutMs = 15_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = await this.evaluate(`Boolean(${expression})`);
      if (value) return true;
      await delay(200);
    }
    throw new Error(`Timed out waiting for expression: ${expression}`);
  }

  async fill(selector, value) {
    const found = await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
        if (descriptor?.set) descriptor.set.call(el, ${JSON.stringify(value)});
        else el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()
    `);
    if (!found) throw new Error(`Unable to find selector: ${selector}`);
  }

  async fillByIndex(selector, index, value) {
    const found = await this.evaluate(`
      (() => {
        const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))[${index}];
        if (!el) return false;
        const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
        if (descriptor?.set) descriptor.set.call(el, ${JSON.stringify(value)});
        else el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()
    `);
    if (!found) throw new Error(`Unable to find selector index: ${selector}[${index}]`);
  }

  async click(selector) {
    const clicked = await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.click();
        return true;
      })()
    `);
    if (!clicked) throw new Error(`Unable to click selector: ${selector}`);
  }

  async clickText(tagName, text) {
    const clicked = await this.evaluate(`
      (() => {
        const items = Array.from(document.querySelectorAll(${JSON.stringify(tagName)}));
        const match = items.find((el) => el.textContent && el.textContent.includes(${JSON.stringify(text)}));
        if (!match) return false;
        match.click();
        return true;
      })()
    `);
    if (!clicked) throw new Error(`Unable to click ${tagName} with text containing "${text}"`);
  }

  async currentPath() {
    return this.evaluate("location.pathname");
  }

  async textContent() {
    return this.evaluate("document.body.innerText");
  }

  async screenshot(fileName) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    await fs.writeFile(path.join(OUTPUT_DIR, fileName), Buffer.from(data, "base64"));
  }

  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
  }

  async close() {
    this.socket.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("Unable to find a debuggable Chrome page target.");
  }

  const page = new CDPPage(pageTarget.webSocketDebuggerUrl);
  await page.ready();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");
  await page.setViewport(1440, 900, false);

  const findings = [];
  const capture = async (name) => page.screenshot(name);

  await fetch(`${BASE_URL}/api/demo/reset`, { method: "POST" }).catch(() => null);
  await page.navigate(`${BASE_URL}/`);
  await page.evaluate(`fetch("/api/auth/logout", { method: "POST" })`);
  await page.navigate(`${BASE_URL}/`);
  let text = await page.textContent();
  const lowerText = text.toLowerCase();
  assert(text.includes("CivicSignal"), "Landing page did not render CivicSignal branding.");
  assert(text.includes("Open Live Map") && lowerText.includes("recent reports") && lowerText.includes("spot it"), "Landing hero surface did not render expected calls to action and preview content.");
  let layout = await page.evaluate(`(() => ({
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    heroVisible: Boolean([...document.querySelectorAll("a")].find((item) => item.textContent.includes("Open Live Map"))?.getBoundingClientRect().top < window.innerHeight)
  }))()`);
  assert(layout.overflowX <= 2, `Landing has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.heroVisible, "Landing primary CTA is not visible in the desktop viewport.");
  await capture("01-landing.png");

  await page.navigate(`${BASE_URL}/app/map`);
  text = await page.textContent();
  const mapText = text.toLowerCase();
  assert(mapText.includes("civicsignal bay map"), "Map column missing.");
  assert(mapText.includes("prioritized community evidence"), "Report column missing.");
  assert(mapText.includes("verification rail"), "Map right rail missing.");
  assert(text.includes("Possible vape sales reported near school walkway"), "Curated school-area demo situation missing from map.");
  assert(text.includes("Reported public fight near transit stop"), "Curated public-disturbance demo situation missing from map.");
  assert(!text.includes("Named person accused"), "Sensitive needs-review report leaked into public map.");
  assert(!mapText.includes("browser audit"), "Generated browser-audit report title leaked into public map.");
  await page.waitForExpression(`(document.querySelector('[data-real-map="maplibre"]') && document.querySelector(".maplibregl-canvas")) || document.querySelector('[data-real-map="osm-raster"] img')`);
  layout = await page.evaluate(`(() => {
    const map = document.querySelector('[data-command-column="map"]')?.getBoundingClientRect();
    const reports = document.querySelector('[data-command-column="reports"]')?.getBoundingClientRect();
    const rail = document.querySelector('[data-command-column="rail"]')?.getBoundingClientRect();
    const topbar = document.querySelector('header')?.getBoundingClientRect();
    const realMap = document.querySelector('[data-real-map="maplibre"], [data-real-map="osm-raster"]')?.getBoundingClientRect();
    const mapCanvas = document.querySelector(".maplibregl-canvas")?.getBoundingClientRect();
    const rasterTile = document.querySelector('[data-real-map="osm-raster"] img')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      topbarHeight: topbar?.height || 0,
      columnsSideBySide: Boolean(map && reports && rail && Math.abs(map.top - reports.top) < 4 && Math.abs(reports.top - rail.top) < 4 && map.left < reports.left && reports.left < rail.left),
      mapHeight: map?.height || 0,
      reportsHeight: reports?.height || 0,
      railHeight: rail?.height || 0,
      realMapHeight: realMap?.height || 0,
      mapCanvasHeight: mapCanvas?.height || rasterTile?.height || 0,
      markerOverlapCount: (() => {
        const rects = [...document.querySelectorAll(".civicsignal-map-marker")].map((item) => item.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < rects.length; i += 1) {
          for (let j = i + 1; j < rects.length; j += 1) {
            if (rects[i].left < rects[j].right && rects[i].right > rects[j].left && rects[i].top < rects[j].bottom && rects[i].bottom > rects[j].top) overlaps += 1;
          }
        }
        return overlaps;
      })(),
    };
  })()`);
  assert(layout.overflowX <= 2, `Map has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.topbarHeight > 0 && layout.topbarHeight <= 72, `App topbar is oversized: ${layout.topbarHeight}px.`);
  assert(layout.columnsSideBySide, "Desktop map command center is not rendering as three side-by-side columns.");
  assert(layout.mapHeight <= 835 && layout.reportsHeight <= 835 && layout.railHeight <= 835, "Map columns exceed the viewport instead of using internal scrolling.");
  assert(layout.realMapHeight > 300 && layout.mapCanvasHeight > 200, "Real map tiles/canvas did not render.");
  assert(layout.markerOverlapCount <= 2, `Default map pins overlap too heavily: ${layout.markerOverlapCount} overlaps.`);
  await capture("02-map-guest.png");

  await page.navigate(`${BASE_URL}/app/submit`);
  text = await page.textContent();
  const submitText = text.toLowerCase();
  assert(submitText.includes("incident entry panel") && submitText.includes("log a local hazard"), "Submit modal shell missing.");
  layout = await page.evaluate(`(() => {
    const overlay = document.querySelector('[data-submit-overlay="true"]')?.getBoundingClientRect();
    const modal = document.querySelector('[data-submit-overlay="true"] section')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      overlayVisible: Boolean(overlay && overlay.width > 0 && overlay.height > 0),
      modalFitsViewport: Boolean(modal && modal.top >= 0 && modal.left >= 0 && modal.right <= window.innerWidth && modal.bottom <= window.innerHeight),
    };
  })()`);
  assert(layout.overflowX <= 2, `Submit page has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.overlayVisible, "Submit overlay is not visible.");
  assert(layout.modalFitsViewport, "Submit modal does not fit within the viewport.");
  await capture("03-submit-guest.png");

  await page.navigate(`${BASE_URL}/app/admin/review`);
  text = await page.textContent();
  assert(text.includes("Unauthorized admin route"), "Guest admin route did not show unauthorized state.");

  await page.navigate(`${BASE_URL}/signup`);
  await page.waitForExpression(`document.querySelector('form button[type="submit"][data-civic-client-ready]')?.dataset.civicClientReady === "true"`);
  const signupStamp = Date.now();
  await page.fill('input[name="display_name"]', `Audit Resident ${signupStamp}`);
  await page.fill('input[type="email"]', `audit-${signupStamp}@civicsignal.demo`);
  await page.fill('input[type="password"]', "audit-pass-123");
  await page.fill('input[name="home_city"]', "North Lake");
  await page.click('button[type="submit"]');
  await page.waitForExpression(`location.pathname === "/app/map"`);
  text = await page.textContent();
  assert(text.includes("Prioritized community evidence"), "Signup flow did not redirect to app map.");
  await capture("04-map-signed-up-user.png");

  await page.navigate(`${BASE_URL}/app/submit`);
  await page.waitForExpression(`document.querySelector('form button[type="submit"][data-civic-client-ready]')?.dataset.civicClientReady === "true"`);
  const reportTitle = `Sidewalk branch obstruction near trail gate ${signupStamp}`;
  await page.fill('input[name="title"]', reportTitle);
  await page.fill('select[name="urgency"]', "serious");
  await page.fill('select[name="category"]', "fallen_tree");
  await page.fill('input[name="address_text"]', "North Lake Trail Gate");
  await page.fill('textarea[name="description"]', "A large branch is blocking the sidewalk and forcing people into the street near the trail gate.");
  await page.clickText("button", "Submit Report");
  await page.waitForExpression(`document.body.innerText.includes("Report submitted")`);
  text = await page.textContent();
  const successText = text.toLowerCase();
  assert(successText.includes("risk score") && successText.includes("view report") && successText.includes("view on map"), "Submit success state did not render expected actions.");
  await page.clickText("a", "View Report");
  await page.waitForExpression(`location.pathname.startsWith("/app/reports/")`);
  text = await page.textContent();
  assert(text.includes(reportTitle), "Report detail page did not render submitted report title.");
  assert(text.includes("Verification Actions"), "Report detail page missing verification section.");
  await capture("05-report-detail.png");

  const clusterLinkExists = await page.evaluate(`Boolean(document.querySelector('a[href*="/app/risks/"]'))`);
  if (clusterLinkExists) {
    await page.click('a[href*="/app/risks/"]');
    await page.waitForExpression(`location.pathname.startsWith("/app/risks/")`);
    text = await page.textContent();
    assert(text.includes("Citizen Reports") && text.includes("Public Signals"), "Cluster detail page did not render expected evidence sections.");
    await capture("06-risk-cluster.png");
  } else {
    findings.push("Submitted report detail did not expose a related cluster link.");
  }

  await page.navigate(`${BASE_URL}/app/feed`);
  text = await page.textContent();
  assert(text.includes("Active civic risks"), "Risk feed page missing.");
  assert(!text.includes("Named person accused"), "Sensitive needs-review report leaked into public feed.");
  assert(!text.toLowerCase().includes("browser audit"), "Generated browser-audit report title leaked into public feed.");

  await page.navigate(`${BASE_URL}/app/signals`);
  text = await page.textContent();
  assert(text.includes("Public-source evidence feed"), "Signals page missing.");

  await page.navigate(`${BASE_URL}/app/analytics`);
  text = await page.textContent();
  assert(text.includes("Local trends and operating metrics"), "Analytics page missing.");

  await page.navigate(`${BASE_URL}/app/settings`);
  text = await page.textContent();
  assert(text.includes("Profile and privacy preferences"), "Settings page missing.");

  await page.evaluate(`fetch("/api/auth/logout", { method: "POST" })`);
  await page.navigate(`${BASE_URL}/login`);
  await page.waitForExpression(`document.querySelector('form button[type="submit"][data-civic-client-ready]')?.dataset.civicClientReady === "true"`);
  await page.fill('input[type="email"]', "admin@civicsignal.demo");
  await page.fill('input[type="password"]', "demo-admin");
  await page.click('button[type="submit"]');
  await page.waitForExpression(`location.pathname === "/app/map"`);

  await page.navigate(`${BASE_URL}/app/admin/review`);
  text = await page.textContent();
  assert(text.includes("Moderation dashboard"), "Admin review page did not render for admin login.");
  await capture("07-admin-review.png");

  await page.navigate(`${BASE_URL}/app/admin/sources`);
  text = await page.textContent();
  assert(text.includes("Manage public data sources"), "Admin sources page did not render.");
  await page.clickText("button", "Test Fetch");
  await page.waitForExpression(`document.body.innerText.includes("Mock preview ready")`);
  await page.clickText("button", "Scan Now");
  await page.waitForExpression(`document.body.innerText.includes("Mock scan imported")`);
  await capture("08-admin-sources.png");

  await page.navigate(`${BASE_URL}/app/signals`);
  text = await page.textContent();
  assert(text.includes("Mock scan from") || text.includes("High wind advisory") || text.includes("Library event crowd guidance"), "Signals page did not show imported admin scan results.");
  await capture("09-signals-after-scan.png");

  await page.setViewport(1920, 1080, false);
  await page.navigate(`${BASE_URL}/app/map`);
  layout = await page.evaluate(`(() => {
    const columns = [...document.querySelectorAll('[data-command-column]')].map((item) => item.getBoundingClientRect());
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      sideBySide: columns.length === 3 && Math.abs(columns[0].top - columns[1].top) < 4 && Math.abs(columns[1].top - columns[2].top) < 4,
    };
  })()`);
  assert(layout.overflowX <= 2, `Wide map has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.sideBySide, "Wide desktop map is not three columns.");
  await capture("10-map-wide.png");

  await page.setViewport(390, 844, true);
  await page.navigate(`${BASE_URL}/app/map`);
  layout = await page.evaluate(`(() => ({
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    hasBottomNav: Boolean(document.querySelector('nav')),
    hasMap: Boolean(document.querySelector('[data-command-column="map"]')),
  }))()`);
  assert(layout.overflowX <= 2, `Mobile map has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.hasMap, "Mobile map column missing.");
  await capture("11-map-mobile.png");

  await page.navigate(`${BASE_URL}/app/submit`);
  layout = await page.evaluate(`(() => {
    const modal = document.querySelector('[data-submit-overlay="true"] section')?.getBoundingClientRect();
    return {
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      modalWidth: modal?.width || 0,
      modalFitsWidth: Boolean(modal && modal.left >= 0 && modal.right <= window.innerWidth),
    };
  })()`);
  assert(layout.overflowX <= 2, `Mobile submit has horizontal overflow: ${layout.overflowX}px.`);
  assert(layout.modalFitsWidth && layout.modalWidth > 0, "Mobile submit modal does not fit width.");
  await capture("12-submit-mobile.png");

  const reportPayload = {
    baseUrl: BASE_URL,
    screenshots: (await fs.readdir(OUTPUT_DIR)).sort(),
    findings,
  };
  await fetch(`${BASE_URL}/api/demo/reset`, { method: "POST" }).catch(() => null);
  await fs.writeFile(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(reportPayload, null, 2));
  console.log(JSON.stringify(reportPayload, null, 2));
  await page.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
