// Dependency-free browser smoke test using Chromium's DevTools protocol.
// Run with the development workflows active. Requires chromium on PATH.
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const origin = process.env.TEST_BASE_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000");
const port = 9333;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evidence = "/tmp/safe-walk-browser";
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.errors = [];
    this.ready = new Promise(resolve => this.ws.addEventListener("open", resolve));
    this.ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id); this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
      } else if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
  }
  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async wait(text, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.eval(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
      await sleep(150);
    }
    throw new Error(`Missing UI text: ${text}`);
  }
  async click(text) {
    const clicked = await this.eval(`(() => {
      const element = Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
      if (!element) return false;
      element.scrollIntoView({block:"center"}); element.click(); return true;
    })()`);
    assert.ok(clicked, `Button missing: ${text}`);
  }
  async screenshot(name) {
    assert.ok(await this.eval("document.documentElement.scrollWidth <= innerWidth + 1"), `${name}: horizontal overflow`);
    const result = await this.call("Page.captureScreenshot", { format: "png" });
    await fs.writeFile(path.join(evidence, `${name}.png`), Buffer.from(result.data, "base64"));
  }
}
async function page(url) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" })).json();
  const c = new CDP(target.webSocketDebuggerUrl);
  await c.call("Page.enable"); await c.call("Runtime.enable"); await c.call("Network.enable");
  await c.call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await c.call("Page.navigate", { url }); return c;
}
async function track(code) { return (await fetch(`${origin}/api/track/${code}`)).json(); }
async function main() {
  await fs.mkdir(evidence, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "safe-walk-chrome-"));
  const browser = spawn(process.env.CHROMIUM_BIN || "chromium", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { stdio: "ignore" });
  browser.on("error", e => { throw e; });
  let root, walker, contact;
  try {
    for (let i = 0; i < 80; i++) {
      try { const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); root = new CDP(version.webSocketDebuggerUrl); break; } catch { await sleep(100); }
    }
    assert.ok(root, "Chromium failed to start");
    await root.call("Browser.setPermission", { permission: { name: "geolocation" }, setting: "denied", origin });
    walker = await page(origin);
    await walker.wait("Take a Demo walk instead");
    if (process.env.TEST_SEARCH_ONLY === "1") {
      await walker.eval(`document.querySelector('input[aria-label="Starting point"]').focus()`);
      await walker.call("Input.insertText", { text: "Washington Square Park New York" });
      assert.equal(await walker.eval('document.body.innerText.includes("Searching addresses…")'), false);
      await walker.eval(`document.querySelector('[aria-label="Search Starting point"]').click()`);
      await walker.wait("Washington Square Park, Manhattan", 20000);
      await walker.eval(`Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.textContent.includes("Washington Square Park, Manhattan")).click()`);
      await walker.wait("Using Washington Square Park");
      await walker.screenshot("search-results");
      assert.deepEqual(walker.errors, []);
      console.log("PASS: deliberate live address search, results selection, selected start, and phone-width layout");
      return;
    }
    if (process.env.TEST_CLEANUP_ONLY === "1") {
      for (const status of ["arrived", "help"]) {
        await walker.click("Take a Demo walk instead"); await walker.wait("Choose this route"); await walker.click("Choose this route");
        await walker.click("Start walk and share link"); await walker.wait("PRIVATE TRACKING LINK");
        if (status === "arrived") await walker.click("I’ve arrived");
        else { await walker.click("Need help"); await walker.click("Yes, mark as needing help"); }
        await walker.wait("Plan another walk"); await sleep(400);
        await walker.screenshot(`cleanup-${status}`);
        await walker.click("Plan another walk");
      }
      assert.deepEqual(walker.errors, []);
      console.log("PASS: rapid route/map transitions and immediate arrival/help have no uncaught map or wake-lock errors");
      return;
    }
    await walker.screenshot("01-plan");
    await walker.click("Use my current location"); await walker.wait("Location permission was denied");
    await walker.click("Take a Demo walk instead"); await walker.wait("Two ways to get there.");
    assert.ok(await walker.eval('!!document.querySelector(".leaflet-container")'), "Route map missing");
    await walker.screenshot("02-route-map");
    await walker.eval(`(() => { const r=Array.from(document.querySelectorAll('[role="radio"]')).find(e=>e.textContent.includes("Safest"));r.scrollIntoView({block:"center"});r.click(); })()`);
    await walker.screenshot("03-route-cards");
    await walker.click("Choose this route"); await walker.wait("Your trusted contact can see your live location until you end the trip.");
    await walker.screenshot("04-consent");
    await walker.click("Start walk and share link"); await walker.wait("PRIVATE TRACKING LINK");
    const credentials = await walker.eval('JSON.parse(localStorage.getItem("safe-walk-trip"))');
    assert.ok(credentials.shareCode); assert.equal(credentials.routeLabel, "Safest");
    const initial = await track(credentials.shareCode);
    await sleep(6200);
    const moved = await track(credentials.shareCode);
    assert.notDeepEqual(moved.lastLocation, initial.lastLocation, "Demo did not move");
    await walker.screenshot("05-walking");
    await walker.call("Page.reload"); await walker.wait("PRIVATE TRACKING LINK");
    assert.ok(await walker.eval('document.body.innerText.includes("Safest")'), "Chosen route not restored");
    assert.ok(await walker.eval('!!document.querySelector(".leaflet-container")'), "Restored map missing");
    contact = await page(`${origin}/track/${credentials.shareCode}`);
    await contact.wait("Your contact is on the way.");
    await contact.screenshot("06-contact-active");
    // Manipulate only this smoke test's freshly created record, never user trips.
    const Database = require("better-sqlite3");
    const db = new Database(process.env.DATABASE_PATH || "data/safe-walk.sqlite");
    db.prepare("UPDATE trips SET last_update_at = ? WHERE id = ?").run(Date.now() - 130000, credentials.tripId);
    db.close();
    await contact.wait("No location update for");
    await contact.screenshot("07-contact-stale");
    await walker.call("Page.bringToFront");
    await walker.click("I’ve arrived"); await walker.wait("You made it.");
    await walker.wait("Plan another walk");
    await walker.screenshot("08-arrived-walker");
    await contact.call("Page.bringToFront"); await contact.wait("Your contact has arrived.");
    const ended = await track(credentials.shareCode);
    await sleep(5300);
    assert.deepEqual((await track(credentials.shareCode)).lastLocation, ended.lastLocation, "Sharing continued after arrival");
    await contact.screenshot("09-arrived-contact");
    console.log("PASS: permission denial, route selection, consent, demo movement, restore, stale banner, arrival, and stopped sharing");

    await walker.call("Page.bringToFront"); await walker.click("Plan another walk");
    await walker.click("Take a Demo walk instead"); await walker.wait("Choose this route"); await walker.click("Choose this route");
    await walker.click("Start walk and share link"); await walker.wait("PRIVATE TRACKING LINK");
    const helpCredentials = await walker.eval('JSON.parse(localStorage.getItem("safe-walk-trip"))');
    await walker.call("Network.setBlockedURLs", { urls: ["*://*/api/trips/*/end"] });
    await walker.click("Need help"); await walker.wait("Mark this trip as needing help?");
    await walker.screenshot("10-help-confirm");
    await walker.click("Yes, mark as needing help"); await walker.wait("Sending your help status…");
    await walker.wait("waiting for a connection");
    assert.equal(await walker.eval('document.body.innerText.includes("Plan another walk")'), false);
    await sleep(500);
    const frozen = (await track(helpCredentials.shareCode)).lastLocation;
    await sleep(5300);
    assert.deepEqual((await track(helpCredentials.shareCode)).lastLocation, frozen, "Location updates continued while end was pending");
    await walker.screenshot("11-offline-end");
    await walker.call("Network.setBlockedURLs", { urls: [] });
    await walker.wait("Your trip is marked for help.", 12000);
    await contact.call("Page.navigate", { url: `${origin}/track/${helpCredentials.shareCode}` });
    await contact.wait("Your contact needs help.");
    assert.deepEqual((await track(helpCredentials.shareCode)).lastLocation, frozen);
    await contact.screenshot("12-help-contact");
    await contact.call("Page.navigate", { url: `${origin}/track/not-a-valid-trip-link` });
    await contact.wait("This link is no longer active.");
    await contact.screenshot("13-expired-link");
    assert.deepEqual(walker.errors, []); assert.deepEqual(contact.errors, []);
    console.log("PASS: help confirmation, offline end retry, no sharing while pending, red help status, invalid/expired link UI, phone-width overflow");
    console.log(`Screenshots: ${evidence}`);
  } finally {
    walker?.ws.close(); contact?.ws.close(); root?.ws.close(); browser.kill("SIGTERM");
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
module.exports = { CDP, page, sleep, origin, port, evidence };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
